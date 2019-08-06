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

import { FoldingRangeProvider, TextDocument, FoldingContext, CancellationToken, FoldingRange, FoldingRangeKind } from "@theia/plugin";
import AbstractSupport from './abstractProvider';
import { blockStructure } from "../omnisharp/utils";
import { Request } from "../omnisharp/protocol";

export class StructureProvider extends AbstractSupport implements FoldingRangeProvider {
    async provideFoldingRanges(document: TextDocument, context: FoldingContext, token: CancellationToken): Promise<FoldingRange[]> {
        let request: Request = {
            FileName: document.fileName,
        };

        try {
            let response = await blockStructure(this.server, request, token);
            let ranges: FoldingRange[] = [];
            for (let member of response.Spans) {
                ranges.push(new FoldingRange(member.Range.Start.Line - 1, member.Range.End.Line - 1, this.GetType(member.Kind)));
            }

            return ranges;
        }
        catch (error) {
            return [];
        }
    }

    GetType(type: string): FoldingRangeKind {
        switch (type) {
            case "Comment":
                return FoldingRangeKind.Comment;
            case "Imports":
                return FoldingRangeKind.Imports;
            case "Region":
                return FoldingRangeKind.Region;
            default:
                return null;
        }
    }

}