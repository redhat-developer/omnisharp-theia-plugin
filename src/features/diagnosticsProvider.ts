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

import { OmniSharpServer } from '../omnisharp/server';
import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { toRange } from '../omnisharp/typeConversion';
import * as theia from '@theia/plugin';
import CompositeDisposable from '../CompositeDisposable';
import { IDisposable } from '../Disposable';
import { isVirtualCSharpDocument } from './virtualDocumentTracker';

export class Advisor {

    private disposable: CompositeDisposable;
    private server: OmniSharpServer;
    private packageRestoreCounter: number = 0;
    private projectSourceFileCounts: { [path: string]: number } = Object.create(null);

    constructor(server: OmniSharpServer) {
        this.server = server;

        let d1 = server.onProjectChange(this.onProjectChange, this);
        let d2 = server.onProjectAdded(this.onProjectAdded, this);
        let d3 = server.onProjectRemoved(this.onProjectRemoved, this);
        let d4 = server.onBeforePackageRestore(this.onBeforePackageRestore, this);
        let d5 = server.onPackageRestore(this.onPackageRestore, this);
        this.disposable = new CompositeDisposable(d1, d2, d3, d4, d5);
    }

    public dispose() {
        this.disposable.dispose();
    }

    public shouldValidateFiles(): boolean {
        return this.isServerStarted()
            && !this.isRestoringPackages();
    }

    public shouldValidateProject(): boolean {
        return this.isServerStarted()
            && !this.isRestoringPackages()
            && !this.isOverFileLimit();
    }

    private updateProjectFileCount(path: string, fileCount: number): void {
        this.projectSourceFileCounts[path] = fileCount;
    }

    private addOrUpdateProjectFileCount(info: protocol.ProjectInformationResponse): void {
        if (info.DotNetProject && info.DotNetProject.SourceFiles) {
            this.updateProjectFileCount(info.DotNetProject.Path, info.DotNetProject.SourceFiles.length);
        }

        if (info.MsBuildProject && info.MsBuildProject.SourceFiles) {
            this.updateProjectFileCount(info.MsBuildProject.Path, info.MsBuildProject.SourceFiles.length);
        }
    }

    private removeProjectFileCount(info: protocol.ProjectInformationResponse): void {
        if (info.DotNetProject && info.DotNetProject.SourceFiles) {
            delete this.projectSourceFileCounts[info.DotNetProject.Path];
        }

        if (info.MsBuildProject && info.MsBuildProject.SourceFiles) {
            delete this.projectSourceFileCounts[info.MsBuildProject.Path];
        }
    }

    private onProjectAdded(info: protocol.ProjectInformationResponse): void {
        this.addOrUpdateProjectFileCount(info);
    }

    private onProjectRemoved(info: protocol.ProjectInformationResponse): void {
        this.removeProjectFileCount(info);
    }

    private onProjectChange(info: protocol.ProjectInformationResponse): void {
        this.addOrUpdateProjectFileCount(info);
    }

    private onBeforePackageRestore(): void {
        this.packageRestoreCounter += 1;
    }

    private onPackageRestore(): void {
        this.packageRestoreCounter -= 1;
    }

    private isRestoringPackages(): boolean {
        return this.packageRestoreCounter > 0;
    }

    private isServerStarted(): boolean {
        return this.server.isRunning();
    }

    private isOverFileLimit(): boolean {
        let sourceFileCount = 0;
        for (let key in this.projectSourceFileCounts) {
            sourceFileCount += this.projectSourceFileCounts[key];
            if (sourceFileCount > 1000) {
                return true;
            }
        }
        return false;
    }
}

export default function reportDiagnostics(server: OmniSharpServer, advisor: Advisor): IDisposable {
    return new DiagnosticsProvider(server, advisor);
}

class DiagnosticsProvider extends AbstractSupport {

    private validationAdvisor: Advisor;
    private disposable: CompositeDisposable;
    private documentValidations: { [uri: string]: theia.CancellationTokenSource } = Object.create(null);
    private projectValidation: theia.CancellationTokenSource;
    private diagnostics: theia.DiagnosticCollection;
    private suppressHiddenDiagnostics: boolean;

    constructor(server: OmniSharpServer, validationAdvisor: Advisor) {
        super(server);

        this.validationAdvisor = validationAdvisor;
        this.diagnostics = theia.languages.createDiagnosticCollection('csharp');
        this.suppressHiddenDiagnostics = theia.workspace.getConfiguration('csharp').get('suppressHiddenDiagnostics', true);

        let d1 = this.server.onPackageRestore(this.validateProject, this);
        let d2 = this.server.onProjectChange(this.validateProject, this);
        let d4 = theia.workspace.onDidOpenTextDocument(event => this.onDocumentAddOrChange(event), this);
        let d3 = theia.workspace.onDidChangeTextDocument(event => this.onDocumentAddOrChange(event.document), this);
        let d5 = theia.workspace.onDidCloseTextDocument(this.onDocumentRemove, this);
        let d6 = theia.window.onDidChangeActiveTextEditor(event => this.onDidChangeActiveTextEditor(event), this);
        let d7 = theia.window.onDidChangeWindowState(event => this.onDidChangeWindowState(event), this);
        this.disposable = new CompositeDisposable(this.diagnostics, d1, d2, d3, d4, d5, d6, d7);

        // Go ahead and check for diagnostics in the currently visible editors.
        for (let editor of theia.window.visibleTextEditors) {
            let document = editor.document;
            if (this.shouldIgnoreDocument(document)) {
                continue;
            }

            this.validateDocument(document);
        }
    }

    public dispose = () => {
        if (this.projectValidation) {
            this.projectValidation.dispose();
        }

        for (let key in this.documentValidations) {
            this.documentValidations[key].dispose();
        }

        this.disposable.dispose();
    }

    private shouldIgnoreDocument(document: theia.TextDocument) {
        if (document.languageId !== 'csharp') {
            return true;
        }

        if (document.uri.scheme !== 'file' &&
            !isVirtualCSharpDocument(document)) {
            return true;
        }

        return false;
    }

    private onDidChangeWindowState(windowState: theia.WindowState): void {
        if (windowState.focused === true) {
            this.onDidChangeActiveTextEditor(theia.window.activeTextEditor);
        }
    }

    private onDidChangeActiveTextEditor(textEditor: theia.TextEditor): void {
        if (textEditor != undefined && textEditor.document != null) {
            this.onDocumentAddOrChange(textEditor.document);
        }
    }

    private onDocumentAddOrChange(document: theia.TextDocument): void {
        if (this.shouldIgnoreDocument(document)) {
            return;
        }

        this.validateDocument(document);
        this.validateProject();
    }

    private onDocumentRemove(document: theia.TextDocument): void {
        let key = document.uri;
        let didChange = false;
        if (this.diagnostics.get(key)) {
            didChange = true;
            this.diagnostics.delete(key);
        }

        let keyString = key.toString();

        if (this.documentValidations[keyString]) {
            didChange = true;
            this.documentValidations[keyString].cancel();
            delete this.documentValidations[keyString];
        }
        if (didChange) {
            this.validateProject();
        }
    }

    private validateDocument(document: theia.TextDocument): void {
        // If we've already started computing for this document, cancel that work.
        let key = document.uri.toString();
        if (this.documentValidations[key]) {
            this.documentValidations[key].cancel();
        }

        if (!this.validationAdvisor.shouldValidateFiles()) {
            return;
        }

        let source = new theia.CancellationTokenSource();
        let handle = setTimeout(async () => {
            try {
                let value = await serverUtils.codeCheck(this.server, { FileName: document.fileName }, source.token);
                let quickFixes = value.QuickFixes;
                // Easy case: If there are no diagnostics in the file, we can clear it quickly.
                if (quickFixes.length === 0) {
                    if (this.diagnostics.has(document.uri)) {
                        this.diagnostics.delete(document.uri);
                    }

                    return;
                }

                // (re)set new diagnostics for this document
                let diagnosticsInFile = this.mapQuickFixesAsDiagnosticsInFile(quickFixes);

                this.diagnostics.set(document.uri, diagnosticsInFile.map(x => x.diagnostic));
            }
            catch (error) {
                return;
            }
        }, 750);

        source.token.onCancellationRequested(() => clearTimeout(handle));
        this.documentValidations[key] = source;
    }

    private mapQuickFixesAsDiagnosticsInFile(quickFixes: protocol.QuickFix[]): { diagnostic: theia.Diagnostic, fileName: string }[] {
        return quickFixes
            .map(quickFix => this.asDiagnosticInFileIfAny(quickFix))
            .filter(diagnosticInFile => diagnosticInFile !== undefined);
    }

    private validateProject(): void {
        // If we've already started computing for this project, cancel that work.
        if (this.projectValidation) {
            this.projectValidation.cancel();
        }

        if (!this.validationAdvisor.shouldValidateProject()) {
            return;
        }

        this.projectValidation = new theia.CancellationTokenSource();
        let handle = setTimeout(async () => {
            try {
                let value = await serverUtils.codeCheck(this.server, { FileName: null }, this.projectValidation.token);

                let quickFixes = value.QuickFixes
                    .sort((a, b) => a.FileName.localeCompare(b.FileName));

                let entries: [theia.Uri, theia.Diagnostic[]][] = [];
                let lastEntry: [theia.Uri, theia.Diagnostic[]];

                for (let diagnosticInFile of this.mapQuickFixesAsDiagnosticsInFile(quickFixes)) {
                    let uri = theia.Uri.file(diagnosticInFile.fileName);

                    if (lastEntry && lastEntry[0].toString() === uri.toString()) {
                        lastEntry[1].push(diagnosticInFile.diagnostic);
                    } else {
                        entries.push([uri, undefined]);
                        lastEntry = [uri, [diagnosticInFile.diagnostic]];
                        entries.push(lastEntry);
                    }
                }

                // Clear diagnostics for files that no longer have any diagnostics.
                this.diagnostics.forEach((uri, diagnostics) => {
                    if (!entries.find(tuple => tuple[0].toString() === uri.toString())) {
                        this.diagnostics.delete(uri);
                    }
                });

                // replace all entries
                this.diagnostics.set(entries);
            }
            catch (error) {
                return;
            }
        }, 3000);

        // clear timeout on cancellation
        this.projectValidation.token.onCancellationRequested(() => {
            clearTimeout(handle);
        });
    }

    private asDiagnosticInFileIfAny(quickFix: protocol.QuickFix): { diagnostic: theia.Diagnostic, fileName: string } {
        let display = this.getDiagnosticDisplay(quickFix, this.asDiagnosticSeverity(quickFix));

        if (display.severity === "hidden") {
            return undefined;
        }

        let message = `${quickFix.Text} [${quickFix.Projects.map(n => this.asProjectLabel(n)).join(', ')}]`;

        let diagnostic = new theia.Diagnostic(toRange(quickFix), message, display.severity);

        if (display.isFadeout) {
            diagnostic.tags = [theia.DiagnosticTag.Unnecessary];
        }

        return { diagnostic: diagnostic, fileName: quickFix.FileName };
    }

    private getDiagnosticDisplay(quickFix: protocol.QuickFix, severity: theia.DiagnosticSeverity | "hidden"): { severity: theia.DiagnosticSeverity | "hidden", isFadeout: boolean } {
        // CS0162 & CS8019 => Unnused using and unreachable code.
        // These hard coded values bring some goodnes of fading even when analyzers are disabled.
        let isFadeout = (quickFix.Tags && !!quickFix.Tags.find(x => x.toLowerCase() == 'unnecessary')) || quickFix.Id == "CS0162" || quickFix.Id == "CS8019";

        if (isFadeout && quickFix.LogLevel.toLowerCase() === 'hidden' || quickFix.LogLevel.toLowerCase() === 'none') {
            // Theres no such thing as hidden severity in theia,
            // however roslyn uses commonly analyzer with hidden to fade out things.
            // Without this any of those doesn't fade anything in theia.
            return { severity: theia.DiagnosticSeverity.Hint, isFadeout };
        }

        return { severity: severity, isFadeout };
    }

    private asDiagnosticSeverity(quickFix: protocol.QuickFix): theia.DiagnosticSeverity | "hidden" {
        switch (quickFix.LogLevel.toLowerCase()) {
            case 'error':
                return theia.DiagnosticSeverity.Error;
            case 'warning':
                return theia.DiagnosticSeverity.Warning;
            case 'info':
                return theia.DiagnosticSeverity.Information;
            case 'hidden':
                if (this.suppressHiddenDiagnostics) {
                    return "hidden";
                }
                return theia.DiagnosticSeverity.Hint;
            default:
                return "hidden";
        }
    }

    private asProjectLabel(projectName: string): string {
        const idx = projectName.indexOf('+');
        return projectName.substr(idx + 1);
    }
}
