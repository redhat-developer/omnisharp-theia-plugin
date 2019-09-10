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
import { EventStream } from './EventStream';
import * as OmniSharp from './omnisharp/extension';
import { InformationMessageObserver } from './observers/InformationMessageObserver';
import { OmnisharpChannelObserver } from './observers/OmnisharpChannelObserver';
import { OmnisharpLoggerObserver } from './observers/OmnisharpLoggerObserver';
import { ProjectStatusBarObserver } from './observers/ProjectStatusBarObserver';
import { StatusBarItemAdapter } from './statusBarItemAdapter';

export async function start(context: theia.PluginContext) {
    const pluginPath = removeLastDirectoryPartOf(__dirname);

    const eventStream = new EventStream();

    let omnisharpChannel = theia.window.createOutputChannel('OmniSharp Log');
    let omnisharpLogObserver = new OmnisharpLoggerObserver(omnisharpChannel);
    let omnisharpChannelObserver = new OmnisharpChannelObserver(omnisharpChannel);
    eventStream.subscribe(omnisharpLogObserver.post);
    eventStream.subscribe(omnisharpChannelObserver.post);

    let informationMessageObserver = new InformationMessageObserver();
    eventStream.subscribe(informationMessageObserver.post);

    let projectStatusBar = new StatusBarItemAdapter(theia.window.createStatusBarItem(theia.StatusBarAlignment.Left));
    let projectStatusBarObserver = new ProjectStatusBarObserver(projectStatusBar);
    eventStream.subscribe(projectStatusBarObserver.post);

    let langServicePromise = OmniSharp.activate(context, eventStream, pluginPath);

    return {
        initializationFinished: async () => {
            let langService = await langServicePromise;
            await langService.server.waitForEmptyEventQueue();
        },
        getAdvisor: async () => {
            let langService = await langServicePromise;
            return langService.advisor;
        },
        eventStream
    };

    function removeLastDirectoryPartOf(path: string) {
        var the_arr = path.split('/');
        the_arr.pop();
        return (the_arr.join('/'));
    }

}
