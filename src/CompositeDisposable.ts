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
import Disposable, { IDisposable } from "./Disposable";

export default class CompositeDisposable extends Disposable {
    private disposables = new Subscription();

    constructor(...disposables: IDisposable[]) {
        super(() => this.disposables.unsubscribe());

        for (const disposable of disposables) {
            if (disposable) {
                this.add(disposable);
            }
            else {
                throw new Error("null disposables are not supported");
            }
        }
    }

    public add(disposable: IDisposable) {
        if (!disposable) {
            throw new Error("disposable cannot be null");
        }

        this.disposables.add(() => disposable.dispose());
    }
}
