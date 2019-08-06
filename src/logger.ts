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

let Subscriber: (message: string) => void;

export function SubscribeToAllLoggers(subscriber: (message: string) => void) {
    Subscriber = subscriber;
}

export class Logger {
    private writer: (message: string) => void;
    private prefix: string;

    private indentLevel: number = 0;
    private indentSize: number = 4;
    private atLineStart: boolean = false;

    constructor(writer: (message: string) => void, prefix?: string) {
        this.writer = writer;
        this.prefix = prefix;
    }

    private appendCore(message: string): void {
        if (this.atLineStart) {
            if (this.indentLevel > 0) {
                const indent = " ".repeat(this.indentLevel * this.indentSize);
                this.write(indent);
            }

            if (this.prefix) {
                this.write(`[${this.prefix}] `);
            }

            this.atLineStart = false;
        }

        this.write(message);
    }

    public increaseIndent(): void {
        this.indentLevel += 1;
    }

    public decreaseIndent(): void {
        if (this.indentLevel > 0) {
            this.indentLevel -= 1;
        }
    }

    public append(message?: string): void {
        message = message || "";
        this.appendCore(message);
    }

    public appendLine(message?: string): void {
        message = message || "";
        this.appendCore(message + '\n');
        this.atLineStart = true;
    }

    private write(message: string) {
        this.writer(message);

        if (Subscriber) {
            Subscriber(message);
        }
    }
}