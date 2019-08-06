/*
 * Copyright (c) 2012-2019 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as theia from '@theia/plugin';
import { CancellationToken } from '@theia/plugin';
import * as path from 'path';
import * as protocol from './protocol';
import * as serverUtils from '../omnisharp/utils';
import { ChildProcess } from 'child_process';
import { LaunchTarget, findLaunchTargets } from './launcher';
import { ReadLine, createInterface } from 'readline';
import { Request, RequestQueueCollection } from './requestQueue';
import { DelayTracker } from './delayTracker';
import { EventEmitter } from 'events';
import { launchOmniSharp } from './launcher';
import { setTimeout } from 'timers';
import * as ObservableEvents from './loggingEvents';
import { EventStream } from '../EventStream';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import CompositeDisposable from '../CompositeDisposable';
import Disposable from '../Disposable';
import * as cp from 'child_process';
import * as os from 'os';
const removeBomBuffer = require("remove-bom-buffer");
const removeBomString = require("strip-bom");

enum ServerState {
    Starting,
    Started,
    Stopped
}

module Events {
    export const StateChanged = 'stateChanged';

    export const StdOut = 'stdout';
    export const StdErr = 'stderr';

    export const Error = 'Error';
    export const ServerError = 'ServerError';

    export const UnresolvedDependencies = 'UnresolvedDependencies';
    export const PackageRestoreStarted = 'PackageRestoreStarted';
    export const PackageRestoreFinished = 'PackageRestoreFinished';

    export const ProjectChanged = 'ProjectChanged';
    export const ProjectAdded = 'ProjectAdded';
    export const ProjectRemoved = 'ProjectRemoved';

    export const MsBuildProjectDiagnostics = 'MsBuildProjectDiagnostics';

    export const BeforeServerInstall = 'BeforeServerInstall';
    export const BeforeServerStart = 'BeforeServerStart';
    export const ServerStart = 'ServerStart';
    export const ServerStop = 'ServerStop';

    export const MultipleLaunchTargets = 'server:MultipleLaunchTargets';

    export const Started = 'started';

    export const ProjectConfiguration = 'ProjectConfiguration';
}

export class OmniSharpServer {

    private static nextId = 1;
    private readLine: ReadLine | undefined;
    private disposables: CompositeDisposable | undefined;

    private delayTrackers: { [requestName: string]: DelayTracker } | undefined;

    private eventBus = new EventEmitter();
    private state: ServerState = ServerState.Stopped;
    private launchTarget: LaunchTarget | undefined;
    private requestQueue: RequestQueueCollection;
    private serverProcess: ChildProcess | undefined;

    private omnisharpManager: OmnisharpManager;
    private updateProjectDebouncer = new Subject<ObservableEvents.ProjectModified>();
    private firstUpdateProject: boolean;

    constructor(private eventStream: EventStream, private extensionPath: string) {
        this.requestQueue = new RequestQueueCollection(this.eventStream, 8, request => this._makeRequest(request));
        this.omnisharpManager = new OmnisharpManager();
        this.updateProjectDebouncer.pipe(debounceTime(1500)).subscribe(() => { this.updateProjectInfo(); });
        this.firstUpdateProject = true;
    }

    public isRunning(): boolean {
        return this.state === ServerState.Started;
    }

    public async waitForEmptyEventQueue(): Promise<void> {
        while (!this.requestQueue.isEmpty()) {
            let p = new Promise((resolve) => setTimeout(resolve, 100));
            await p;
        }
    }

    private setState(value: ServerState): void {
        if (typeof value !== 'undefined' && value !== this.state) {
            this.state = value;
            this.fireEvent(Events.StateChanged, this.state);
        }
    }

    private recordRequestDelay(requestName: string, elapsedTime: number) {
        if (!this.delayTrackers) {
            return;
        }
        let tracker = this.delayTrackers[requestName];
        if (!tracker) {
            tracker = new DelayTracker(requestName);
            this.delayTrackers[requestName] = tracker;
        }

        tracker.reportDelay(elapsedTime);
    }

    public getSolutionPathOrFolder(): string | undefined {
        return this.launchTarget
            ? this.launchTarget.target
            : undefined;
    }

    // --- eventing
    public onStdout(listener: (e: string) => any, thisArg?: any) {
        return this.addListener(Events.StdOut, listener, thisArg);
    }

    public onStderr(listener: (e: string) => any, thisArg?: any) {
        return this.addListener(Events.StdErr, listener, thisArg);
    }

    public onError(listener: (e: protocol.ErrorMessage) => any, thisArg?: any) {
        return this.addListener(Events.Error, listener, thisArg);
    }

    public onServerError(listener: (err: any) => any, thisArg?: any) {
        return this.addListener(Events.ServerError, listener, thisArg);
    }

    public onUnresolvedDependencies(listener: (e: protocol.UnresolvedDependenciesMessage) => any, thisArg?: any) {
        return this.addListener(Events.UnresolvedDependencies, listener, thisArg);
    }

    public onBeforePackageRestore(listener: () => any, thisArg?: any) {
        return this.addListener(Events.PackageRestoreStarted, listener, thisArg);
    }

    public onPackageRestore(listener: () => any, thisArg?: any) {
        return this.addListener(Events.PackageRestoreFinished, listener, thisArg);
    }

    public onProjectChange(listener: (e: protocol.ProjectInformationResponse) => any, thisArg?: any) {
        return this.addListener(Events.ProjectChanged, listener, thisArg);
    }

    public onProjectAdded(listener: (e: protocol.ProjectInformationResponse) => any, thisArg?: any) {
        return this.addListener(Events.ProjectAdded, listener, thisArg);
    }

    public onProjectRemoved(listener: (e: protocol.ProjectInformationResponse) => any, thisArg?: any) {
        return this.addListener(Events.ProjectRemoved, listener, thisArg);
    }

    public onMsBuildProjectDiagnostics(listener: (e: protocol.MSBuildProjectDiagnostics) => any, thisArg?: any) {
        return this.addListener(Events.MsBuildProjectDiagnostics, listener, thisArg);
    }

    public onBeforeServerInstall(listener: () => any) {
        return this.addListener(Events.BeforeServerInstall, listener);
    }

    public onBeforeServerStart(listener: (e: string) => any) {
        return this.addListener(Events.BeforeServerStart, listener);
    }

    public onServerStart(listener: (e: string) => any) {
        return this.addListener(Events.ServerStart, listener);
    }

    public onServerStop(listener: () => any) {
        return this.addListener(Events.ServerStop, listener);
    }

    public onMultipleLaunchTargets(listener: (targets: LaunchTarget[]) => any, thisArg?: any) {
        return this.addListener(Events.MultipleLaunchTargets, listener, thisArg);
    }

    public onOmnisharpStart(listener: () => any) {
        return this.addListener(Events.Started, listener);
    }

    private addListener(event: string, listener: (e: any) => any, thisArg?: any): Disposable {
        listener = thisArg ? listener.bind(thisArg) : listener;
        this.eventBus.addListener(event, listener);
        return new Disposable(() => this.eventBus.removeListener(event, listener));
    }

    protected fireEvent(event: string, args: any): void {
        this.eventBus.emit(event, args);
    }

    private async start(launchTarget: LaunchTarget): Promise<void> {

        let disposables = new CompositeDisposable();

        disposables.add(this.onServerError(err =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnServerError(err))
        ));

        disposables.add(this.onError((message: protocol.ErrorMessage) =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnError(message))
        ));

        disposables.add(this.onMsBuildProjectDiagnostics((message: protocol.MSBuildProjectDiagnostics) =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerMsBuildProjectDiagnostics(message))
        ));

        disposables.add(this.onUnresolvedDependencies((message: protocol.UnresolvedDependenciesMessage) =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerUnresolvedDependencies(message))
        ));

        disposables.add(this.onStderr((message: string) =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnStdErr(message))
        ));

        disposables.add(this.onMultipleLaunchTargets((targets: LaunchTarget[]) =>
            this.eventStream.post(new ObservableEvents.OmnisharpOnMultipleLaunchTargets(targets))
        ));

        disposables.add(this.onBeforeServerInstall(() =>
            this.eventStream.post(new ObservableEvents.OmnisharpOnBeforeServerInstall())
        ));

        disposables.add(this.onBeforeServerStart(() => {
            this.eventStream.post(new ObservableEvents.OmnisharpOnBeforeServerStart());
        }));

        disposables.add(this.onServerStop(() =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnStop())
        ));

        disposables.add(this.onServerStart(() => {
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnStart());
        }));

        disposables.add(this.onProjectConfigurationReceived((message: protocol.ProjectConfigurationMessage) => {
            this.eventStream.post(new ObservableEvents.ProjectConfiguration(message));
        }));

        disposables.add(this.onProjectAdded(this.debounceUpdateProjectWithLeadingTrue));
        disposables.add(this.onProjectChange(this.debounceUpdateProjectWithLeadingTrue));
        disposables.add(this.onProjectRemoved(this.debounceUpdateProjectWithLeadingTrue));

        this.disposables = disposables;

        this.setState(ServerState.Starting);
        this.launchTarget = launchTarget;

        const solutionPath = launchTarget.target;
        const cwd = path.dirname(solutionPath);

        let args = [
            '-s', solutionPath,
            '--hostPID', process.pid.toString(),
            'DotNet:enablePackageRestore=false',
            '--encoding', 'utf-8',
            '--loglevel', 'information'
        ];

        let workspaceConfig = theia.workspace.getConfiguration();
        let excludePaths = [];
        if (workspaceConfig) {
            let excludeFilesOption = workspaceConfig.get<{ [i: string]: boolean }>('files.exclude');
            if (excludeFilesOption) {
                for (let field in excludeFilesOption) {
                    if (excludeFilesOption[field]) {
                        excludePaths.push(field);
                    }
                }
            }
        }
        for (let i = 0; i < excludePaths.length; i++) {
            args.push(`FileOptions:SystemExcludeSearchPatterns:${i}=${excludePaths[i]}`);
        }

        let launchInfo: LaunchInfo;
        try {
            launchInfo = await this.omnisharpManager.GetOmniSharpLaunchInfo(this.extensionPath);
        }
        catch (error) {
            return;
        }

        this.eventStream.post(new ObservableEvents.OmnisharpInitialisation(new Date(), solutionPath));
        this.fireEvent(Events.BeforeServerStart, solutionPath);

        try {
            let launchResult = await launchOmniSharp(cwd, args, launchInfo);
            this.eventStream.post(new ObservableEvents.OmnisharpLaunch(launchResult.monoPath, launchResult.command, launchResult.process.pid));

            this.serverProcess = launchResult.process;
            this.delayTrackers = {};

            await this._doConnect();
            this.setState(ServerState.Started);
            this.fireEvent(Events.ServerStart, solutionPath);

            this.requestQueue.drain();
        }
        catch (err) {
            this.fireEvent(Events.ServerError, err);
            return this.stop();
        }
    }

    private onProjectConfigurationReceived(listener: (e: protocol.ProjectConfigurationMessage) => void) {
        return this.addListener(Events.ProjectConfiguration, listener);
    }

    private debounceUpdateProjectWithLeadingTrue = () => {
        // Call the updateProjectInfo directly if it is the first time, otherwise debounce the request
        // This needs to be done so that we have a project information for the first incoming request

        if (this.firstUpdateProject) {
            this.updateProjectInfo();
        }
        else {
            this.updateProjectDebouncer.next(new ObservableEvents.ProjectModified());
        }
    }

    private updateProjectInfo = async () => {
        this.firstUpdateProject = false;
        let info = await serverUtils.requestWorkspaceInformation(this);
        //once we get the info, push the event into the event stream
        this.eventStream.post(new ObservableEvents.WorkspaceInformationUpdated(info));
    }

    public async stop(): Promise<void> {

        let cleanupPromise: Promise<void>;

        if (!this.serverProcess) {
            // nothing to kill
            cleanupPromise = Promise.resolve();
        }
        else {
            // Kill Unix process and children
            cleanupPromise = getUnixChildProcessIds(this.serverProcess.pid)
                .then(children => {
                    for (let child of children) {
                        process.kill(child, 'SIGTERM');
                    }

                    if (this.serverProcess) {
                        this.serverProcess.kill('SIGTERM');
                    }
                });
        }

        let disposables = this.disposables;
        this.disposables = undefined;

        return cleanupPromise.then(() => {
            this.serverProcess = undefined;
            this.setState(ServerState.Stopped);
            this.fireEvent(Events.ServerStop, this);
            if (disposables) {
                disposables.dispose();
            }
        });
    }

    public async restart(launchTarget: LaunchTarget | undefined = this.launchTarget): Promise<void> {
        if (launchTarget) {
            await this.stop();
            this.eventStream.post(new ObservableEvents.OmnisharpRestart());
            await this.start(launchTarget);
        }
    }

    public autoStart(): Promise<void> {
        return findLaunchTargets().then(async launchTargets => {
            if (launchTargets.length === 0) {
                return new Promise<void>((resolve, reject) => {
                    // 1st watch for files
                    let watcher = theia.workspace.createFileSystemWatcher('{**/*.sln,**/*.csproj,**/project.json,**/*.csx,**/*.cake}',
                        /*ignoreCreateEvents*/ false,
                        /*ignoreChangeEvents*/ true,
                        /*ignoreDeleteEvents*/ true);

                    watcher.onDidCreate(() => {
                        watcher.dispose();
                        resolve();
                    });
                }).then(() => {
                    // 2nd try again
                    return this.autoStart();
                });
            }
            return this.restart(launchTargets[0]);
        });
    }

    public async makeRequest<TResponse>(command: string, data?: any, token?: CancellationToken): Promise<TResponse> {

        if (!this.isRunning()) {
            return Promise.reject<TResponse>('OmniSharp server is not running.');
        }

        let startTime: number;
        let request: Request;

        let promise = new Promise<TResponse>((resolve, reject) => {
            startTime = Date.now();

            request = {
                command,
                data,
                onSuccess: value => resolve(value),
                onError: err => reject(err)
            };

            this.requestQueue.enqueue(request);
        });

        if (token) {
            token.onCancellationRequested(() => {
                this.requestQueue.cancelRequest(request);
            });
        }

        return promise.then(response => {
            let endTime = Date.now();
            let elapsedTime = endTime - startTime;
            this.recordRequestDelay(command, elapsedTime);

            return response;
        });
    }

    private async _doConnect(): Promise<void> {
        if (this.serverProcess && this.serverProcess.stderr) {
            this.serverProcess.stderr.on('data', (data: Buffer) => {
                let trimData = this.removeBOMFromBuffer(data);
                if (trimData.length > 0) {
                    this.fireEvent(Events.StdErr, trimData.toString());
                }
            });

            this.readLine = createInterface({
                input: this.serverProcess.stdout,
                output: this.serverProcess.stdin,
                terminal: false
            });
        }

        const promise = new Promise<void>((resolve, reject) => {
            let listener: Disposable;

            // Convert the timeout from the seconds to milliseconds, which is required by setTimeout().
            const timeoutDuration = 100 * 1000;

            // timeout logic
            const handle = setTimeout(() => {
                if (listener) {
                    listener.dispose();
                }
            }, timeoutDuration);

            // handle started-event
            listener = this.onOmnisharpStart(() => {
                if (listener) {
                    listener.dispose();
                }

                clearTimeout(handle);
                resolve();
            });
        });

        const lineReceived = this.onLineReceived.bind(this);

        this.readLine.addListener('line', lineReceived);

        this.disposables.add(new Disposable(() => {
            this.readLine.removeListener('line', lineReceived);
        }));

        return promise;
    }

    private onLineReceived(line: string) {
        line = this.removeBOMFromString(line);

        if (line[0] !== '{') {
            this.eventStream.post(new ObservableEvents.OmnisharpServerMessage(line));
            return;
        }

        let packet: protocol.WireProtocol.Packet;
        try {
            packet = JSON.parse(line);
        }
        catch (err) {
            return;
        }

        if (!packet.Type) {
            return;
        }

        switch (packet.Type) {
            case 'response':
                this._handleResponsePacket(<protocol.WireProtocol.ResponsePacket>packet);
                break;
            case 'event':
                this._handleEventPacket(<protocol.WireProtocol.EventPacket>packet);
                break;
            default:
                this.eventStream.post(new ObservableEvents.OmnisharpServerMessage(`Unknown packet type: ${packet.Type}`));
                break;
        }
    }

    private removeBOMFromBuffer(buffer: Buffer): Buffer {
        return <Buffer>removeBomBuffer(buffer);
    }

    private removeBOMFromString(line: string): string {
        return removeBomString(line.trim());
    }

    private _handleResponsePacket(packet: protocol.WireProtocol.ResponsePacket) {
        const request = this.requestQueue.dequeue(packet.Command, packet.Request_seq);

        if (!request) {
            this.eventStream.post(new ObservableEvents.OmnisharpServerMessage(`Received response for ${packet.Command} but could not find request.`));
            return;
        }

        this.eventStream.post(new ObservableEvents.OmnisharpServerVerboseMessage(`handleResponse: ${packet.Command} (${packet.Request_seq})`));

        if (packet.Success) {
            request.onSuccess(packet.Body);
        }
        else {
            request.onError(packet.Message || packet.Body);
        }

        this.requestQueue.drain();
    }

    private _handleEventPacket(packet: protocol.WireProtocol.EventPacket): void {
        if (packet.Event === 'log') {
            const entry = <{ LogLevel: string; Name: string; Message: string; }>packet.Body;
            this.eventStream.post(new ObservableEvents.OmnisharpEventPacketReceived(entry.LogLevel, entry.Name, entry.Message));
        }
        else {
            // fwd all other events
            this.fireEvent(packet.Event, packet.Body);
        }
    }

    private _makeRequest(request: Request) {
        const id = OmniSharpServer.nextId++;

        const requestPacket: protocol.WireProtocol.RequestPacket = {
            Type: 'request',
            Seq: id,
            Command: request.command,
            Arguments: request.data
        };

        this.serverProcess.stdin.write(JSON.stringify(requestPacket) + '\n');
        return id;
    }
}

export async function getUnixChildProcessIds(pid: number): Promise<number[]> {
    return new Promise<number[]>((resolve, reject) => {
        let ps = cp.exec('ps -A -o ppid,pid', (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }

            if (stderr) {
                return reject(stderr);
            }

            if (!stdout) {
                return resolve([]);
            }

            let lines = stdout.split(os.EOL);
            let pairs = lines.map(line => line.trim().split(/\s+/));

            let children = [];

            for (let pair of pairs) {
                let ppid = parseInt(pair[0]);
                if (ppid === pid) {
                    children.push(parseInt(pair[1]));
                }
            }

            resolve(children);
        });

        ps.on('error', reject);
    });
}

export interface LaunchInfo {
    LaunchPath: string;
    MonoLaunchPath?: string;
}
class OmnisharpManager {
    public async GetOmniSharpLaunchInfo(extensionPath: string): Promise<LaunchInfo> {
        let basePath = path.resolve(extensionPath, '.omnisharp');
        return {
            LaunchPath: path.join(basePath, 'run'),
            MonoLaunchPath: path.join(basePath, 'omnisharp', 'OmniSharp.exe')
        };
    }
}
