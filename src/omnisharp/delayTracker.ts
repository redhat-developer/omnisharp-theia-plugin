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

const ImmedateDelayMax = 25;
const NearImmediateDelayMax = 50;
const ShortDelayMax = 250;
const MediumDelayMax = 500;
const IdleDelayMax = 1500;
const NonFocusDelayMax = 3000;

export class DelayTracker {
    private _name: string;

    private immediateDelays: number = 0;      // 0-25 milliseconds
    private nearImmediateDelays: number = 0;  // 26-50 milliseconds
    private shortDelays: number = 0;          // 51-250 milliseconds
    private mediumDelays: number = 0;         // 251-500 milliseconds
    private idleDelays: number = 0;           // 501-1500 milliseconds
    private nonFocusDelays: number = 0;       // 1501-3000 milliseconds
    private bigDelays: number = 0;            // 3000+ milliseconds

    constructor(name: string) {
        this._name = name;
    }

    public reportDelay(elapsedTime: number) {
        if (elapsedTime <= ImmedateDelayMax) {
            this.immediateDelays += 1;
        }
        else if (elapsedTime <= NearImmediateDelayMax) {
            this.nearImmediateDelays += 1;
        }
        else if (elapsedTime <= ShortDelayMax) {
            this.shortDelays += 1;
        }
        else if (elapsedTime <= MediumDelayMax) {
            this.mediumDelays += 1;
        }
        else if (elapsedTime <= IdleDelayMax) {
            this.idleDelays += 1;
        }
        else if (elapsedTime <= NonFocusDelayMax) {
            this.nonFocusDelays += 1;
        }
        else {
            this.bigDelays += 1;
        }
    }

    public name(): string {
        return this._name;
    }

    public clearMeasures() {
        this.immediateDelays = 0;
        this.nearImmediateDelays = 0;
        this.shortDelays = 0;
        this.mediumDelays = 0;
        this.idleDelays = 0;
        this.nonFocusDelays = 0;
        this.bigDelays = 0;
    }

    public hasMeasures() {
        return this.immediateDelays > 0
            || this.nearImmediateDelays > 0
            || this.shortDelays > 0
            || this.mediumDelays > 0
            || this.idleDelays > 0
            || this.nonFocusDelays > 0
            || this.bigDelays > 0;
    }

    public getMeasures(): { [key: string]: number } {
        return {
            immediateDelays: this.immediateDelays,
            nearImmediateDelays: this.nearImmediateDelays,
            shortDelays: this.shortDelays,
            mediumDelays: this.mediumDelays,
            idleDelays: this.idleDelays,
            nonFocusDelays: this.nonFocusDelays,
            bigDelays: this.bigDelays
        };
    }
}
