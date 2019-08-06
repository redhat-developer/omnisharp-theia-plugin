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

import { spawn, ChildProcess } from 'child_process';

import * as path from 'path';
import * as theia from '@theia/plugin';
import { LaunchInfo } from './server';

export enum LaunchTargetKind {
    Solution,
    ProjectJson,
    Folder,
    Csx,
    Cake
}

/**
 * Represents the project or solution that OmniSharp is to be launched with.
 * */
export interface LaunchTarget {
    label: string;
    description: string;
    directory: string;
    target: string;
    kind: LaunchTargetKind;
}

/**
 * Returns a list of potential targets on which OmniSharp can be launched.
 * This includes `project.json` files, `*.sln` files (if any `*.csproj` files are found), and the root folder
 * (if it doesn't contain a `project.json` file, but `project.json` files exist). In addition, the root folder
 * is included if there are any `*.csproj` files present, but a `*.sln* file is not found.
 */
export async function findLaunchTargets(): Promise<LaunchTarget[]> {
    if (!theia.workspace.workspaceFolders) {
        return Promise.resolve([]);
    }

    const projectFiles = await theia.workspace.findFiles(
        /*include*/ '{**/*.sln,**/*.csproj,**/project.json,**/*.csx,**/*.cake}',
        /*exclude*/ '{**/node_modules/**,**/.git/**,**/bower_components/**}',
        /*maxResults*/ 10);

    const csFiles = await theia.workspace.findFiles(
        /*include*/ '{**/*.cs}',
        /*exclude*/ '{**/node_modules/**,**/.git/**,**/bower_components/**}',
        /*maxResults*/ 10);

    return resourcesToLaunchTargets(projectFiles.concat(csFiles));
}

function resourcesToLaunchTargets(resources: theia.Uri[]): LaunchTarget[] {
    if (!Array.isArray(resources)) {
        return [];
    }

    let workspaceFolderToUriMap = new Map<number, theia.Uri[]>();

    for (let resource of resources) {
        let folder = theia.workspace.getWorkspaceFolder(resource);
        if (folder) {
            let buckets: theia.Uri[] | undefined;

            if (workspaceFolderToUriMap.has(folder.index)) {
                buckets = workspaceFolderToUriMap.get(folder.index);
            } else {
                buckets = [];
                workspaceFolderToUriMap.set(folder.index, buckets);
            }

            if (buckets) {
                buckets.push(resource);
            }
        }
    }

    let targets: LaunchTarget[] = [];

    workspaceFolderToUriMap.forEach((resources, folderIndex) => {
        let hasCsProjFiles = false,
            hasSlnFile = false,
            hasProjectJson = false,
            hasProjectJsonAtRoot = false,
            hasCSX = false,
            hasCake = false,
            hasCs = false;

        hasCsProjFiles = resources.some(isCSharpProject);

        let folderPath: string = '';
        if (theia.workspace.workspaceFolders) {
            let folder = theia.workspace.workspaceFolders[folderIndex];
            folderPath = folder.uri.fsPath;
        }

        resources.forEach(resource => {
            // Add .sln files if there are .csproj files
            if (hasCsProjFiles && isSolution(resource)) {
                hasSlnFile = true;
                targets.push({
                    label: path.basename(resource.fsPath),
                    description: theia.workspace.asRelativePath(path.dirname(resource.fsPath)) || '',
                    target: resource.fsPath,
                    directory: path.dirname(resource.fsPath),
                    kind: LaunchTargetKind.Solution
                });
            }

            // Add project.json files
            if (isProjectJson(resource)) {
                const dirname = path.dirname(resource.fsPath);
                hasProjectJson = true;
                hasProjectJsonAtRoot = hasProjectJsonAtRoot || dirname === folderPath;

                targets.push({
                    label: path.basename(resource.fsPath),
                    description: theia.workspace.asRelativePath(path.dirname(resource.fsPath)) || '',
                    target: dirname,
                    directory: dirname,
                    kind: LaunchTargetKind.ProjectJson
                });
            }

            // Discover if there is any CSX file
            if (!hasCSX && isCsx(resource)) {
                hasCSX = true;
            }

            // Discover if there is any Cake file
            if (!hasCake && isCake(resource)) {
                hasCake = true;
            }

            //Discover if there is any cs file
            if (!hasCs && isCs(resource)) {
                hasCs = true;
            }
        });

        // Add the root folder under the following circumstances:
        // * If there are .csproj files, but no .sln file, and none in the root.
        // * If there are project.json files, but none in the root.
        if ((hasCsProjFiles && !hasSlnFile) || (hasProjectJson && !hasProjectJsonAtRoot)) {
            targets.push({
                label: path.basename(folderPath),
                description: '',
                target: folderPath,
                directory: folderPath,
                kind: LaunchTargetKind.Folder
            });
        }

        // if we noticed any CSX file(s), add a single CSX-specific target pointing at the root folder
        if (hasCSX) {
            targets.push({
                label: "CSX",
                description: path.basename(folderPath),
                target: folderPath,
                directory: folderPath,
                kind: LaunchTargetKind.Csx
            });
        }

        // if we noticed any Cake file(s), add a single Cake-specific target pointing at the root folder
        if (hasCake) {
            targets.push({
                label: "Cake",
                description: path.basename(folderPath),
                target: folderPath,
                directory: folderPath,
                kind: LaunchTargetKind.Cake
            });
        }

        if (hasCs && !hasSlnFile && !hasCsProjFiles && !hasProjectJson && !hasProjectJsonAtRoot) {
            targets.push({
                label: path.basename(folderPath),
                description: '',
                target: folderPath,
                directory: folderPath,
                kind: LaunchTargetKind.Folder
            });
        }
    });

    return targets.sort((a, b) => a.directory.localeCompare(b.directory));
}

function isCSharpProject(resource: theia.Uri): boolean {
    return /\.csproj$/i.test(resource.fsPath);
}

function isSolution(resource: theia.Uri): boolean {
    return /\.sln$/i.test(resource.fsPath);
}

function isProjectJson(resource: theia.Uri): boolean {
    return /\project.json$/i.test(resource.fsPath);
}

function isCsx(resource: theia.Uri): boolean {
    return /\.csx$/i.test(resource.fsPath);
}

function isCake(resource: theia.Uri): boolean {
    return /\.cake$/i.test(resource.fsPath);
}

function isCs(resource: theia.Uri): boolean {
    return /\.cs$/i.test(resource.fsPath);
}

export interface LaunchResult {
    process: ChildProcess;
    command: string;
    monoVersion?: string;
    monoPath?: string;
}

export async function launchOmniSharp(cwd: string, args: string[], launchInfo: LaunchInfo): Promise<LaunchResult> {
    return new Promise<LaunchResult>((resolve, reject) => {
        launch(cwd, args, launchInfo)
            .then(result => {
                // async error - when target not not ENEOT
                result.process.on('error', err => {
                    reject(err);
                });

                // success after a short freeing event loop
                setTimeout(function() {
                    resolve(result);
                }, 0);
            })
            .catch(reason => reject(reason));
    });
}

async function launch(cwd: string, args: string[], launchInfo: LaunchInfo): Promise<LaunchResult> {
    args.push(`formattingOptions:useTabs=true`);
    args.push(`formattingOptions:tabSize=4`);
    args.push(`formattingOptions:indentationSize=4`);

    return launchNix(launchInfo.LaunchPath, cwd, args);
}

function launchNix(launchPath: string, cwd: string, args: string[]): LaunchResult {
    let process = spawn(launchPath, args, {
        detached: false,
        cwd: cwd
    });

    return {
        process,
        command: launchPath
    };
}
