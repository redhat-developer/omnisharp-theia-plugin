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

export class StatusBarItemAdapter implements theia.StatusBarItem {

    get alignment(): theia.StatusBarAlignment {
        return this.statusBarItem.alignment;
    }

    get priority(): number {
        return this.statusBarItem.priority;
    }

    get text(): string {
        return this.statusBarItem.text;
    }

    set text(value: string) {
        this.statusBarItem.text = value;
    }

    get tooltip(): string {
        return this.statusBarItem.tooltip;
    }

    set tooltip(value: string) {
        this.statusBarItem.tooltip = value;
    }

    get color(): string {
        return this.statusBarItem.color as string;
    }

    set color(value: string) {
        this.statusBarItem.color = value;
    }

    get command(): string {
        return this.statusBarItem.command;
    }

    set command(value: string) {
        this.statusBarItem.command = value;
    }

    show(): void {
        this.statusBarItem.show();
    }

    hide(): void {
        this.statusBarItem.hide();
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }

    constructor(private statusBarItem: theia.StatusBarItem) {
    }
}
