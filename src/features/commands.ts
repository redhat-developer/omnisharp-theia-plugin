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

import { OmniSharpServer } from '../omnisharp/server';
import * as serverUtils from '../omnisharp/utils';
import { findLaunchTargets } from '../omnisharp/launcher';
import * as cp from 'child_process';
import * as protocol from '../omnisharp/protocol';
import * as theia from '@theia/plugin';
import { ShowOmniSharpChannel, CommandDotNetRestoreStart, CommandDotNetRestoreProgress, CommandDotNetRestoreSucceeded, CommandDotNetRestoreFailed } from '../omnisharp/loggingEvents';
import { EventStream } from '../EventStream';
import CompositeDisposable from '../CompositeDisposable';

export default function registerCommands(server: OmniSharpServer, eventStream: EventStream): CompositeDisposable {
    let disposable = new CompositeDisposable();
    disposable.add(theia.commands.registerCommand({ id: 'o.restart' }, () => restartOmniSharp(server)));
    disposable.add(theia.commands.registerCommand({ id: 'o.pickProjectAndStart' }, async () => pickProjectAndStart(server)));
    disposable.add(theia.commands.registerCommand({ id: 'o.showOutput' }, () => eventStream.post(new ShowOmniSharpChannel())));
    disposable.add(theia.commands.registerCommand({ id: 'dotnet.restore.all' }, async () => dotnetRestoreAllProjects(server, eventStream)));

    return new CompositeDisposable(disposable);
}

function restartOmniSharp(server: OmniSharpServer) {
    if (server.isRunning()) {
        server.restart();
    }
    else {
        server.autoStart();
    }
}

async function pickProjectAndStart(server: OmniSharpServer): Promise<void> {
    return findLaunchTargets().then(targets => {

        let currentPath = server.getSolutionPathOrFolder();
        if (currentPath) {
            for (let target of targets) {
                if (target.target === currentPath) {
                    target.label = `\u2713 ${target.label}`;
                }
            }
        }

        return theia.window.showQuickPick(targets, {
            matchOnDescription: true,
            placeHolder: `Select 1 of ${targets.length} projects`
        }).then(async launchTarget => {
            if (launchTarget) {
                return server.restart(launchTarget);
            }
        });
    });
}

async function dotnetRestoreAllProjects(server: OmniSharpServer, eventStream: EventStream): Promise<void> {
    let descriptors = await getProjectDescriptors(server);
    eventStream.post(new CommandDotNetRestoreStart());
    for (let descriptor of descriptors) {
        await dotnetRestore(descriptor.Directory, eventStream);
    }
}

async function getProjectDescriptors(server: OmniSharpServer): Promise<protocol.ProjectDescriptor[]> {
    if (!server.isRunning()) {
        return Promise.reject('OmniSharp server is not running.');
    }

    let info = await serverUtils.requestWorkspaceInformation(server);
    let descriptors = protocol.getDotNetCoreProjectDescriptors(info);
    if (descriptors.length === 0) {
        return Promise.reject("No .NET Core projects found");
    }

    return descriptors;
}

export async function dotnetRestore(cwd: string, eventStream: EventStream, filePath?: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let cmd = 'dotnet';
        let args = ['restore'];

        if (filePath) {
            args.push(filePath);
        }

        let dotnet = cp.spawn(cmd, args, { cwd: cwd, env: process.env });

        function handleData(stream: NodeJS.ReadableStream) {
            stream.on('data', chunk => {
                eventStream.post(new CommandDotNetRestoreProgress(chunk.toString()));
            });

            stream.on('err', err => {
                eventStream.post(new CommandDotNetRestoreProgress(`ERROR: ${err}`));
            });
        }

        handleData(dotnet.stdout);
        handleData(dotnet.stderr);

        dotnet.on('close', (code, signal) => {
            eventStream.post(new CommandDotNetRestoreSucceeded(`Done: ${code}.`));
            resolve();
        });

        dotnet.on('error', err => {
            eventStream.post(new CommandDotNetRestoreFailed(`ERROR: ${err}`));
            reject(err);
        });
    });
}
