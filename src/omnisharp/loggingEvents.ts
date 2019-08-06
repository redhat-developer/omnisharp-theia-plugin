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

import * as protocol from './protocol';
import { LaunchTarget } from "./launcher";
import { EventType } from "./EventType";

export interface BaseEvent {
    type: EventType;
}
export class OmnisharpInitialisation implements BaseEvent {
    type = EventType.OmnisharpInitialisation;
    constructor(public timeStamp: Date, public solutionPath: string) { }
}

export class OmnisharpLaunch implements BaseEvent {
    type = EventType.OmnisharpLaunch;
    constructor(public monoPath: string | undefined, public command: string | undefined, public pid: number) { }
}

export class OmnisharpFailure implements BaseEvent {
    type = EventType.OmnisharpFailure;
    constructor(public message: string, public error: Error) { }
}
export class OmnisharpServerOnError implements BaseEvent {
    type = EventType.OmnisharpServerOnError;
    constructor(public errorMessage: protocol.ErrorMessage) { }
}

export class OmnisharpServerMsBuildProjectDiagnostics implements BaseEvent {
    type = EventType.OmnisharpServerMsBuildProjectDiagnostics;
    constructor(public diagnostics: protocol.MSBuildProjectDiagnostics) { }
}

export class OmnisharpServerUnresolvedDependencies implements BaseEvent {
    type = EventType.OmnisharpServerUnresolvedDependencies;
    constructor(public unresolvedDependencies: protocol.UnresolvedDependenciesMessage) { }
}

export class OmnisharpServerEnqueueRequest implements BaseEvent {
    type = EventType.OmnisharpServerEnqueueRequest;
    constructor(public name: string, public command: string) { }
}

export class OmnisharpServerDequeueRequest implements BaseEvent {
    type = EventType.OmnisharpServerDequeueRequest;
    constructor(public name: string, public command: string, public id: number) { }
}

export class OmnisharpServerProcessRequestStart implements BaseEvent {
    type = EventType.OmnisharpServerProcessRequestStart;
    constructor(public name: string) { }
}

export class OmnisharpEventPacketReceived implements BaseEvent {
    type = EventType.OmnisharpEventPacketReceived;
    constructor(public logLevel: string, public name: string, public message: string) { }
}

export class OmnisharpServerOnServerError implements BaseEvent {
    type = EventType.OmnisharpServerOnServerError;
    constructor(public err: any) { }
}

export class OmnisharpOnMultipleLaunchTargets implements BaseEvent {
    type = EventType.OmnisharpOnMultipleLaunchTargets;
    constructor(public targets: LaunchTarget[]) { }
}

export class ProjectConfiguration implements BaseEvent {
    type = EventType.ProjectConfigurationReceived;
    constructor(public projectConfiguration: protocol.ProjectConfigurationMessage) { }
}

export class WorkspaceInformationUpdated implements BaseEvent {
    type = EventType.WorkspaceInformationUpdated;
    constructor(public info: protocol.WorkspaceInformationResponse) { }
}

export class EventWithMessage implements BaseEvent {
    type = EventType.EventWithMessage;
    constructor(public message: string) { }
}

export class DocumentSynchronizationFailure implements BaseEvent {
    type = EventType.DocumentSynchronizationFailure;
    constructor(public documentPath: string, public errorMessage: string) { }
}

export class CommandDotNetRestoreProgress extends EventWithMessage {
    type = EventType.CommandDotNetRestoreProgress;
}
export class CommandDotNetRestoreSucceeded extends EventWithMessage {
    type = EventType.CommandDotNetRestoreSucceeded;
}
export class CommandDotNetRestoreFailed extends EventWithMessage {
    type = EventType.CommandDotNetRestoreFailed;
}

export class OmnisharpServerOnStdErr extends EventWithMessage {
    type = EventType.OmnisharpServerOnStdErr;
}
export class OmnisharpServerMessage extends EventWithMessage {
    type = EventType.OmnisharpServerMessage;
}
export class OmnisharpServerVerboseMessage extends EventWithMessage {
    type = EventType.OmnisharpServerVerboseMessage;
}
export class ProjectModified implements BaseEvent {
    type = EventType.ProjectModified;
}
export class ShowOmniSharpChannel implements BaseEvent {
    type = EventType.ShowOmniSharpChannel;
}
export class CommandDotNetRestoreStart implements BaseEvent {
    type = EventType.CommandDotNetRestoreStart;
}
export class OmnisharpServerProcessRequestComplete implements BaseEvent {
    type = EventType.OmnisharpServerProcessRequestComplete;
}
export class OmnisharpOnBeforeServerStart implements BaseEvent {
    type = EventType.OmnisharpOnBeforeServerStart;
}
export class OmnisharpOnBeforeServerInstall implements BaseEvent {
    type = EventType.OmnisharpOnBeforeServerInstall;
}
export class OmnisharpServerOnStop implements BaseEvent {
    type = EventType.OmnisharpServerOnStop;
}
export class OmnisharpServerOnStart implements BaseEvent {
    type = EventType.OmnisharpServerOnStart;
}
export class OmnisharpRestart implements BaseEvent {
    type = EventType.OmnisharpRestart;
}
