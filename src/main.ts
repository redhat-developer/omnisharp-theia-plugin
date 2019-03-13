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

/**
 * Plug-in for Theia which registers language server to work with C#.
 * The language server is based in https://github.com/OmniSharp/omnisharp-roslyn. 
 */
import * as theia from '@theia/plugin';
import * as cp from 'child_process';
import * as path from 'path';

export async function start(context: theia.PluginContext) {
    const CSHARP_LS_ID = 'csharp';
    const RUN_PATH = path.resolve(__dirname, '..', 'server', 'run');

    const csharpLanguageServerInfo: theia.LanguageServerInfo = {
        id: CSHARP_LS_ID,
        name: 'C#',
        command: RUN_PATH,
        globPatterns: ['**/*.cs', '**/*.csx', '**/*.csproj'],
        args: ['-lsp']
    }

    const outputChannel: theia.OutputChannel = theia.window.createOutputChannel('dotnet-log');
    outputChannel.clear();
    outputChannel.show();

    dotnetRestoreAllProjects(outputChannel);

    context.subscriptions.push(theia.languageServer.registerLanguageServerProvider(csharpLanguageServerInfo));
}

async function dotnetRestoreAllProjects(outputChannel: theia.OutputChannel) {
    if (!theia.workspace.workspaceFolders) {
        return;
    }

    const projectFiles = await theia.workspace.findFiles(
        /*include*/ '{**/*.csproj,**/project.json}',
        /*exclude*/ '{**/node_modules/**,**/.git/**,**/bower_components/**}',
        /*maxResults*/ 250);


    let projects = new Set();
    for (let resource of projectFiles) {
        let folder = theia.workspace.getWorkspaceFolder(resource);
        if (folder) {
            projects.add(folder as theia.WorkspaceFolder);
        }
    }

    for (let project of projects) {
        restoreProject(project, outputChannel);
    }
}

function restoreProject(folder: theia.WorkspaceFolder, outputChannel: theia.OutputChannel) {
    let cmd = 'dotnet';
    let args = ['restore'];

    let workspaceFolder = folder as theia.WorkspaceFolder;
    let directory = workspaceFolder.uri.path;

    let dotnet = cp.spawn(cmd, args, { cwd: directory, env: process.env });

    function handleData(stream: NodeJS.ReadableStream | null) {
        if (!stream) {
            return;
        }
        stream.on('data', chunk => {
            outputChannel.appendLine(chunk.toString());
        });

        stream.on('err', err => {
            outputChannel.appendLine(`ERROR: ${err}`);
        });
    }

    handleData(dotnet.stdout);
    handleData(dotnet.stderr);

    dotnet.on('close', (code, signal) => {
        outputChannel.appendLine(`Done: ${code}`);
        outputChannel.show();
    });

    dotnet.on('error', err => {
        outputChannel.appendLine(`ERROR: ${err}`);
    });
}