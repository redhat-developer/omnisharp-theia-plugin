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
import { Subject, Subscription } from "rxjs";
import { BaseEvent } from "./omnisharp/loggingEvents";

export class EventStream {
    private sink: Subject<BaseEvent>;

    constructor() {
        this.sink = new Subject<BaseEvent>();
    }

    public post(event: BaseEvent) {
        this.sink.next(event);
    }

    public subscribe(eventHandler: (event: BaseEvent) => void): Subscription {
        return this.sink.subscribe(eventHandler);
    }
}