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
import { Subscription } from "rxjs";

export default class Disposable implements IDisposable {
    private onDispose: { (): void };

    constructor(onDispose: { (): void } | Subscription) {
        if (!onDispose) {
            throw new Error("onDispose cannot be null or empty.");
        }

        if (onDispose instanceof Subscription) {
            this.onDispose = () => onDispose.unsubscribe();
        }
        else {
            this.onDispose = onDispose;
        }
    }

    public dispose = (): void => {
        this.onDispose();
    }
}

export interface IDisposable {
    dispose: () => void;
}