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

import * as vscode from "vscode";
import { ext } from "../extensionVariables";
import { DataSourceFiles } from "../models/dataSource";
import { InsightsNode } from "../services/kdbTreeProvider";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";

export class DataSourcesPanel {
  public static currentPanel: DataSourcesPanel | undefined;
  private uri;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  public static dataSourceFile: DataSourceFiles;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    datasourceFile: DataSourceFiles
  ) {
    this.uri = extensionUri;
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      extensionUri,
      datasourceFile
    );
    this._panel.webview.onDidReceiveMessage((message) => {
      if (message.command === "kdb.dataSource.saveDataSource") {
        this._panel.title = message.data.name;
        vscode.commands.executeCommand(
          "kdb.dataSource.saveDataSource",
          message.data
        );
      } else if (message.command === "kdb.dataSource.runDataSource") {
        vscode.commands.executeCommand(
          "kdb.dataSource.runDataSource",
          message.data
        );
      }
    });
  }

  public static render(
    extensionUri: vscode.Uri,
    datasourceFile: DataSourceFiles
  ) {
    this.dataSourceFile = datasourceFile;
    if (DataSourcesPanel.currentPanel) {
      DataSourcesPanel.currentPanel.dispose();
    }
    const panel = vscode.window.createWebviewPanel(
      "dataSource",
      datasourceFile.name,
      vscode.ViewColumn.One,
      {
        // Enable javascript in the webview
        enableScripts: true,
        // Restrict the webview to only load resources from the `out` directory
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out")],
      }
    );

    DataSourcesPanel.currentPanel = new DataSourcesPanel(
      panel,
      extensionUri,
      datasourceFile
    );
  }

  public refresh() {
    DataSourcesPanel.render(this.uri, DataSourcesPanel.dataSourceFile);
  }

  public dispose() {
    DataSourcesPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private generateTarget(
    isInsights: boolean,
    isMetaLoaded: boolean,
    targetApi: string
  ) {
    if (isInsights) {
      if (isMetaLoaded) {
        const auxArray = ext.insightsMeta.dap;
        const auxOptions = auxArray
          .map((dap) => {
            const generatedValue = dap.assembly + " " + dap.instance;
            const option =
              generatedValue === targetApi
                ? /* html*/ `<vscode-option value="${generatedValue}" selected>${generatedValue}</vscode-option>`
                : /* html*/ `<vscode-option value="${generatedValue}">${generatedValue}</vscode-option>`;
            return option;
          })
          .join("");
        return /* html*/ `<vscode-dropdown id="selectedTarget" name="selectedTarget" value="${targetApi}" class="dropdown">
        ${auxOptions}
      </vscode-dropdown>`;
      }
    }
    return /* html*/ `<vscode-dropdown id="selectedTarget" name="selectedTarget" class="dropdown">
        <vscode-option>Not connected to Insights</vscode-option>
      </vscode-dropdown>`;
  }

  private generateTables(
    isInsights: boolean,
    isMetaLoaded: boolean,
    targetTable: string
  ) {
    if (isInsights) {
      if (isMetaLoaded) {
        const auxArray = ext.insightsMeta.assembly;
        const auxOptions = auxArray
          .map((assembly) => {
            const options: string[] = [];
            assembly.tbls.forEach((tbl) => {
              const generatedValue = tbl;
              const option =
                generatedValue === targetTable
                  ? /* html*/ `<vscode-option value="${generatedValue}" selected>${generatedValue}</vscode-option>`
                  : /* html*/ `<vscode-option value="${generatedValue}">${generatedValue}</vscode-option>`;
              options.push(option);
            });
            return options.join("");
          })
          .join("");
        return /* html*/ `<vscode-dropdown id="selectedTable" name="selectedTable" value="${targetTable}" class="dropdown">
        ${auxOptions}
      </vscode-dropdown>`;
      }
    }
    return /* html*/ `<vscode-dropdown id="selectedTarget" name="selectedTarget" class="dropdown">
        <vscode-option>Not connected to Insights</vscode-option>
      </vscode-dropdown>`;
  }

  private generateApiTarget(
    isInsights: boolean,
    isMetaLoaded: boolean,
    target: string
  ) {
    if (isInsights) {
      if (isMetaLoaded) {
        const auxArray = ext.insightsMeta.api.filter(
          (api) => api.api === ".kxi.getData" || !api.api.startsWith(".kxi.")
        );
        const auxOptions = auxArray
          .map((api) => {
            const generatedValue =
              api.api === ".kxi.getData"
                ? api.api.replace(".kxi.", "")
                : api.api;
            const option =
              generatedValue === target
                ? /* html*/ `<vscode-option value="${generatedValue}" selected>${generatedValue}</vscode-option>`
                : /* html*/ `<vscode-option value="${generatedValue}">${generatedValue}</vscode-option>`;
            return option;
          })
          .join("");
        return /* html*/ `<vscode-dropdown  id="selectedApi" name="selectedApi" value="${target}" class="dropdown">
        ${auxOptions}
      </vscode-dropdown>`;
      }
    }
    return /* html*/ `<vscode-dropdown id="selectedTarget" name="selectedTarget" class="dropdown">
        <vscode-option>Not connected to Insights</vscode-option>
      </vscode-dropdown>`;
  }

  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    datasourceFile: DataSourceFiles
  ) {
    const isMetaLoaded = ext.insightsMeta.dap ? true : false;
    const isInsights = ext.connectionNode instanceof InsightsNode;
    const webviewUri = getUri(webview, extensionUri, ["out", "webview.js"]);
    const nonce = getNonce();
    const styleUri = getUri(webview, extensionUri, [
      "out",
      "dataSourcesPanel.css",
    ]);
    const resetStyleUri = getUri(webview, extensionUri, ["out", "reset.css"]);
    const vscodeStyleUri = getUri(webview, extensionUri, ["out", "vscode.css"]);

    const tabSelected =
      datasourceFile.dataSource.selectedType.toString() === "API"
        ? "tab-1"
        : datasourceFile.dataSource.selectedType.toString() === "QSQL"
        ? "tab-2"
        : "tab-3";
    const loadedSelectedType =
      datasourceFile.dataSource.selectedType.toString() === "API"
        ? "API"
        : datasourceFile.dataSource.selectedType.toString() === "QSQL"
        ? "QSQL"
        : "SQL";

    let params = "";
    if (datasourceFile.dataSource.api.params.length > 0) {
      for (let i = 0; i < datasourceFile.dataSource.api.params.length; i++) {
        params += `<div class="field-row  param-row">
                    <vscode-text-field size="100" id="param${
                      i + 1
                    }" name="param${i + 1}" placeholder="Param ${
          i + 1
        }" value="${
          datasourceFile.dataSource.api.params[i]
        }" class="text-input param-input" value></vscode-text-field>
                  </div>`;
      }
    } else {
      params = `<div class="field-row  param-row">
                  <vscode-text-field size="100" id="param1" name="param1" placeholder="Param 1" class="text-input param-input"></vscode-text-field>
                </div>`;
    }
    const apiSelected = datasourceFile.dataSource.api.selectedApi;
    const tableSelected = datasourceFile.dataSource.api.selectedTable;
    const qsql = datasourceFile.dataSource.qsql.query;
    const qsqlTarget = datasourceFile.dataSource.qsql.selectedTarget;
    const sql = datasourceFile.dataSource.sql.query;
    const name = datasourceFile.name;

    const targetHtml = this.generateTarget(
      isInsights,
      isMetaLoaded,
      qsqlTarget
    );

    const apiHtml = this.generateApiTarget(
      isInsights,
      isMetaLoaded,
      apiSelected
    );

    const tableHtml = this.generateTables(
      isInsights,
      isMetaLoaded,
      tableSelected
    );

    return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';" />
        <link rel="stylesheet" href="${resetStyleUri}" />
        <link rel="stylesheet" href="${vscodeStyleUri}" />
        <link rel="stylesheet" href="${styleUri}" />
        <title>DataSource</title>
      </head>
      <body>
      <form id="dataSourceForm">
        <div class="datasource-view-container">
          <div class="content-wrapper">
            <div class="field-row name-row">
              <label for="name">DataSource Name</label>
              <vscode-text-field size="100" id="name" name="name" placeholder="DataSource Name" value="${name}" class="text-input name-input"></vscode-text-field>
              <input type="hidden" name="originalName" value="${name}" />
            </div>
              <div  class="form-wrapper">
                <vscode-panels activeid="${tabSelected}">
                  <vscode-panel-tab id="tab-1" class="type-tab">API</vscode-panel-tab>
                  <vscode-panel-tab id="tab-2" class="type-tab">QSQL</vscode-panel-tab>
                  <vscode-panel-tab id="tab-3" class="type-tab">SQL</vscode-panel-tab>
                  <input type="hidden" name="selectedType" value="${loadedSelectedType}" />
                  <vscode-panel-view id="view-1">
                    <div class="editor-panel">
                      <div class="field-row">
                        <div class="dropdown-container">
                          <label for="selectedApi">Select API</label>
                          ${apiHtml}
                        </div>
                      </div>
                      <div class="field-row">
                        <div class="dropdown-container">
                          <label for="selectedTable">Table</label>
                          ${tableHtml}
                        </div>
                      </div>
                      <div id="params-wrapper">
                      <label>Params</label>
                        ${params}
                      </div>
                      <div class="field-row">
                        <vscode-button id="addParam" appearance="secondary" class="btn-add-param">ADD PARAM</vscode-button>
                        <vscode-button id="removeParam" appearance="secondary" class="btn-remove-param">REMOVE PARAM</vscode-button>
                      </div>
                    </div>
                  </vscode-panel-view>
                  <vscode-panel-view id="view-2">
                    <div class="editor-panel">
                    <div class="field-row">
                        <div class="dropdown-container">
                          <label for="selectedTarget">Target</label>
                          ${targetHtml}
                        </div>
                      </div>
                      <div class="field-row">
                        <vscode-text-area
                          class="text-area"
                          id="qsql"
                          name="qsql"
                          value="${qsql}"
                          rows="20">Query</vscode-text-area>
                      </div>
                      
                    </div>
                  </vscode-panel-view>
                  <vscode-panel-view id="view-3">
                    <div class="editor-panel">
                      <div class="field-row">
                        <vscode-text-area
                          class="text-area"
                          id="sql"
                          value="${sql}"
                          name="sql"
                          rows="20">Query</vscode-text-area>
                      </div>
                    </div>
                  </vscode-panel-view>
                </vscode-panels>
              </div>
              <div class="actions-wrapper">
                <div class="btn-actions-group">
                  <div class="btn-action">
                    <vscode-button id="save" appearance="primary" class="btn-save">SAVE</vscode-button>
                  </div>
                  <div class="btn-action">
                    <vscode-button id="run" appearance="secondary" class="btn-run">RUN</vscode-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
        <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          const saveButton = document.getElementById('save');
          const runButton = document.getElementById('run');
          const addButton = document.getElementById('addParam');
          const removeButton = document.getElementById('removeParam');
          const tabs = document.querySelectorAll('.type-tab');

          tabs.forEach((tab) => {
            tab.addEventListener('click', (event) => {
              const tabId = event.target.id;
              const form = document.getElementById('dataSourceForm');
              let type = '';
              switch (tabId) {
                case 'tab-1':
                  type = 'API';
                  break;
                case 'tab-2':
                  type = 'QSQL';
                  break;
                case 'tab-3':
                default:
                  type = 'SQL';
                  break;
              };
              form.elements['selectedType'].value = type;
            });
          });

          saveButton.addEventListener('click', (event) => {
            event.preventDefault();
            const form = document.getElementById('dataSourceForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            vscode.postMessage({
              command: 'kdb.dataSource.saveDataSource',
              data
            });
          });

          runButton.addEventListener('click', (event) => {
            event.preventDefault();
            const form = document.getElementById('dataSourceForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            vscode.postMessage({
              command: 'kdb.dataSource.runDataSource',
              data
            });
          });

          addButton.addEventListener('click', () => {
            const paramWrapper = document.getElementById('params-wrapper');
            const paramsFields = document.querySelectorAll('.param-input');
            const count = paramsFields.length;
            const newParam = document.createElement('vscode-text-field');
            newParam.setAttribute('size', '100');
            newParam.setAttribute('id', 'param-' + (count + 1));
            newParam.setAttribute('class', 'text-input param-input');
            newParam.setAttribute('name', 'param-' + (count + 1));
            newParam.setAttribute('placeholder', 'Param ' + (count + 1));
            const newParamRow = document.createElement('div');
            newParamRow.setAttribute('class', 'field-row param-row');
            newParamRow.appendChild(newParam);
            paramWrapper.appendChild(newParamRow);
          });

          removeButton.addEventListener('click', () => {
            const paramsFields = document.querySelectorAll('.param-row');
            const count = paramsFields.length;
            if (count > 1) {
              const lastParam = paramsFields[count - 1];
              lastParam.remove();
            }            
          });
        </script>
      </body>
    </html>
    `;
  }
}
