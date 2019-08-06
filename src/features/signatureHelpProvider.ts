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

import AbstractSupport from './abstractProvider';
import * as serverUtils from '../omnisharp/utils';
import { createRequest } from '../omnisharp/typeConversion';
import * as theia from '@theia/plugin';
import { SignatureHelpParameter } from '../omnisharp/protocol';

export default class OmniSharpSignatureHelpProvider extends AbstractSupport implements theia.SignatureHelpProvider {

    public async provideSignatureHelp(document: theia.TextDocument, position: theia.Position, token: theia.CancellationToken): Promise<theia.SignatureHelp> {

        let req = createRequest(document, position);

        try {
            let res = await serverUtils.signatureHelp(this.server, req, token);

            if (!res) {
                return undefined;
            }

            let ret = new theia.SignatureHelp();
            ret.activeSignature = res.ActiveSignature;
            ret.activeParameter = res.ActiveParameter;

            for (let signature of res.Signatures) {

                let signatureInfo = new theia.SignatureInformation(signature.Label, signature.StructuredDocumentation.SummaryText);
                ret.signatures.push(signatureInfo);

                for (let parameter of signature.Parameters) {
                    let parameterInfo = new theia.ParameterInformation(
                        parameter.Label,
                        this.GetParameterDocumentation(parameter));

                    signatureInfo.parameters.push(parameterInfo);
                }
            }

            return ret;
        }
        catch (error) {
            return undefined;
        }
    }

    private GetParameterDocumentation(parameter: SignatureHelpParameter) {
        let summary = parameter.Documentation;
        if (summary.length > 0) {
            let paramText = `**${parameter.Name}**: ${summary}`;
            return new theia.MarkdownString(paramText);
        }

        return "";
    }
}
