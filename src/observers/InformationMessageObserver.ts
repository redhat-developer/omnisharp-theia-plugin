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

import * as ObservableEvent from "../omnisharp/loggingEvents";
import showInformationMessage from "./utils/ShowInformationMessage";
import { EventType } from "../omnisharp/EventType";
import * as theia from '@theia/plugin';

export class InformationMessageObserver {
    constructor() {
    }

    public post = (event: ObservableEvent.BaseEvent) => {
        switch (event.type) {
            case EventType.OmnisharpServerUnresolvedDependencies:
                this.handleOmnisharpServerUnresolvedDependencies(<ObservableEvent.OmnisharpServerUnresolvedDependencies>event);
                break;
        }
    }

    private async handleOmnisharpServerUnresolvedDependencies(event: ObservableEvent.OmnisharpServerUnresolvedDependencies) {
        //to do: determine if we need the unresolved dependencies message
        let csharpConfig = theia.workspace.getConfiguration('csharp');
        if (!csharpConfig.get<boolean>('suppressDotnetRestoreNotification')) {
            let message = `There are unresolved dependencies. Please execute the restore command to continue.`;
            return showInformationMessage(message, { title: "Restore", command: "dotnet.restore.all" });
        }
    }
}
