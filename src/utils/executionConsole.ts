/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

import { OutputChannel, commands, window } from "vscode";

export class ExecutionConsole {
  public static current: ExecutionConsole | undefined;
  private _console: OutputChannel;

  constructor(private console: OutputChannel) {
    this._console = console;
  }

  public static start(): ExecutionConsole {
    if (!ExecutionConsole.current) {
      const _console = window.createOutputChannel("q Console Output");
      ExecutionConsole.current = new ExecutionConsole(_console);
    }
    return ExecutionConsole.current;
  }

  public dispose(): void {
    ExecutionConsole.current = undefined;
    this._console.dispose();
  }

  public appendQuery(query: string): void {
    if (query.length > 0) {
      this._console.appendLine(query);
      this._console.appendLine("");
    }
  }

  public append(
    output: string | string[],
    query = "",
    serverName: string
  ): void {
    this._console.show(true);
    //TODO: this._console.clear(); Add an option in the future to clear or not the console
    const date = new Date();
    this._console.appendLine(
      `>>> ${serverName}  @ ${date.toLocaleTimeString()} <<<`
    );
    this.appendQuery(query);
    if (Array.isArray(output)) {
      this._console.appendLine(output[0]);
      output.forEach((o) => this._console.appendLine(o));
    } else {
      this._console.appendLine(output);
      this.rendResults(output);
    }
    this._console.appendLine(`<<<\n`);
  }

  public appendQueryError(
    query: string,
    result: string,
    isConnected: boolean,
    serverName: string
  ): void {
    this._console.show(true);
    //TODO: this._console.clear(); Add an option in the future to clear or not the console
    const date = new Date();
    this._console.appendLine(
      `<<< ERROR -  ${serverName}  @ ${date.toLocaleTimeString()} >>>`
    );
    if (isConnected) {
      this._console.appendLine(`ERROR Query executed: ${query}`);
      this._console.appendLine(result);
    } else {
      this._console.appendLine(`Please connect to a kdb+ server`);
    }
    this._console.appendLine(`<<< >>>`);
  }

  // this to debug in case debug of extension doesn't work
  public appendQueryDebug(msg: string) {
    this._console.appendLine(msg);
  }

  public rendResults(query: string) {
    commands.executeCommand("kdb.resultsPanel.update", query);
  }
}
