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

import { BaseChannelObserver } from "./BaseChannelObserver";
import { BaseEvent } from '../omnisharp/loggingEvents';
import { EventType } from "../omnisharp/EventType";

export class OmnisharpChannelObserver extends BaseChannelObserver {

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.ShowOmniSharpChannel:
            case EventType.OmnisharpFailure:
            case EventType.OmnisharpServerOnStdErr:
                this.showChannel(true);
                break;
            case EventType.OmnisharpRestart:
                this.clearChannel();
                break;
        }
    }
}