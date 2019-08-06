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

import * as protocol from '../omnisharp/protocol';

const summaryStartTag = /<summary>/i;
const summaryEndTag = /<\/summary>/i;

export function extractSummaryText(xmlDocComment: string): string {
    if (!xmlDocComment) {
        return xmlDocComment;
    }

    let summary = xmlDocComment;

    let startIndex = summary.search(summaryStartTag);
    if (startIndex < 0) {
        return summary;
    }

    summary = summary.slice(startIndex + '<summary>'.length);

    let endIndex = summary.search(summaryEndTag);
    if (endIndex < 0) {
        return summary;
    }

    return summary.slice(0, endIndex);
}

export function GetDocumentationString(structDoc: protocol.DocumentationComment) {
    let newLine = "\n\n";
    let documentation = "";

    if (structDoc) {
        if (structDoc.SummaryText) {
            documentation += structDoc.SummaryText + newLine;
        }

        documentation = documentation.trim();
    }

    return documentation;
}

export function displayDocumentationObject(obj: protocol.DocumentationItem): string {
    return obj.Name + ": " + obj.Documentation;
}
