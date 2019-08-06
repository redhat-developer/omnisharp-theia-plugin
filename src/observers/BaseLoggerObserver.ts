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

import { Logger } from "../logger";
import * as theia from '@theia/plugin';
import { BaseEvent } from '../omnisharp/loggingEvents';

export abstract class BaseLoggerObserver {
    public logger: Logger;
    constructor(channel: theia.OutputChannel | Logger) {
        if (channel instanceof Logger) {
            this.logger = channel;
        }
        else {
            this.logger = new Logger((message) => channel.append(message));
        }
    }

    abstract post: (event: BaseEvent) => void;
}