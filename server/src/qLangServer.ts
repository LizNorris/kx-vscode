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

import { TextDocument } from "vscode-languageserver-textdocument";
import {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  Connection,
  DefinitionParams,
  DocumentSymbol,
  DocumentSymbolParams,
  InitializeParams,
  Location,
  Position,
  Range,
  ReferenceParams,
  RenameParams,
  ServerCapabilities,
  SymbolKind,
  TextDocumentIdentifier,
  TextDocumentSyncKind,
  TextDocuments,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver/node";
import { Identifier, IdentifierKind, Token, TokenKind, parse } from "./parser";

const enum FindKind {
  Reference,
  Definition,
  Rename,
  Completion,
}

function rangeFromToken(token: Token): Range {
  return Range.create(
    (token.startLine || 1) - 1,
    (token.startColumn || 1) - 1,
    (token.endLine || 1) - 1,
    token.endColumn || 1,
  );
}

function isLocal(tokens: Token[], target: Token) {
  if (!target.scope) {
    return false;
  }
  if (target.scope.nullary) {
    if (
      target.identifier === "x" ||
      target.identifier === "y" ||
      target.identifier === "z"
    ) {
      return true;
    }
  }
  return !!tokens.find(
    (token) =>
      token.kind === TokenKind.Assignment &&
      token.scope === target.scope &&
      token.identifier === target.identifier,
  );
}

function positionToToken(tokens: Token[], position: Position) {
  return tokens.find((token) => {
    const { start, end } = rangeFromToken(token);
    return (
      start.line <= position.line &&
      end.line >= position.line &&
      start.character <= position.character &&
      end.character >= position.character
    );
  });
}

function getLabel(token: Token, source?: Token): string {
  const label = token.identifier || token.image;

  if (source?.namespace) {
    if (label.startsWith(source.namespace)) {
      return label.replace(`${source.namespace}.`, "");
    }
  }

  return label;
}

export default class QLangServer {
  private declare connection: Connection;
  private declare params: InitializeParams;
  public declare documents: TextDocuments<TextDocument>;

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection;
    this.params = params;
    this.documents = new TextDocuments(TextDocument);
    this.documents.listen(this.connection);
    this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
    this.connection.onReferences(this.onReferences.bind(this));
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onRenameRequest(this.onRenameRequest.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));
  }

  public capabilities(): ServerCapabilities {
    return {
      textDocumentSync: TextDocumentSyncKind.Full,
      documentSymbolProvider: true,
      referencesProvider: true,
      definitionProvider: true,
      renameProvider: true,
      completionProvider: { resolveProvider: false },
    };
  }

  public onDocumentSymbol({
    textDocument,
  }: DocumentSymbolParams): DocumentSymbol[] {
    const tokens = this.parse(textDocument);
    return tokens
      .filter((token) => token.kind === TokenKind.Assignment && !token.scope)
      .map((token) =>
        DocumentSymbol.create(
          getLabel(token),
          undefined,
          token.lambda ? SymbolKind.Object : SymbolKind.Variable,
          rangeFromToken(token),
          rangeFromToken(token),
          tokens
            .filter(
              (child) =>
                child.scope &&
                child.scope === token.lambda &&
                child.kind === TokenKind.Assignment,
            )
            .map((token) =>
              DocumentSymbol.create(
                token.image,
                undefined,
                token.identifierKind === IdentifierKind.Argument
                  ? SymbolKind.Array
                  : SymbolKind.Variable,
                rangeFromToken(token),
                rangeFromToken(token),
              ),
            ),
        ),
      );
  }

  public onReferences({ textDocument, position }: ReferenceParams): Location[] {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    return this.findIdentifiers(FindKind.Reference, tokens, source).map(
      (token) => Location.create(textDocument.uri, rangeFromToken(token)),
    );
  }

  public onDefinition({
    textDocument,
    position,
  }: DefinitionParams): Location[] {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    return this.findIdentifiers(FindKind.Definition, tokens, source).map(
      (token) => Location.create(textDocument.uri, rangeFromToken(token)),
    );
  }

  public onRenameRequest({
    textDocument,
    position,
    newName,
  }: RenameParams): WorkspaceEdit | null {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    const edits = this.findIdentifiers(FindKind.Rename, tokens, source).map(
      (token) => TextEdit.replace(rangeFromToken(token), newName),
    );
    return edits.length === 0
      ? null
      : {
          changes: {
            [textDocument.uri]: edits,
          },
        };
  }

  public onCompletion({
    textDocument,
    position,
  }: CompletionParams): CompletionItem[] {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    return this.findIdentifiers(FindKind.Completion, tokens, source).map(
      (token) => ({
        label: getLabel(token, source),
        kind: token.lambda
          ? CompletionItemKind.Function
          : CompletionItemKind.Variable,
      }),
    );
  }

  private parse(textDocument: TextDocumentIdentifier): Token[] {
    const document = this.documents.get(textDocument.uri);
    if (!document) {
      return [];
    }
    return parse(document.getText());
  }

  private findIdentifiers(
    kind: FindKind,
    tokens: Token[],
    source?: Token,
  ): Token[] {
    if (!source || source.identifierKind === IdentifierKind.Unassignable) {
      return [];
    }
    switch (kind) {
      case FindKind.Rename:
      case FindKind.Reference:
        return isLocal(tokens, source)
          ? tokens.filter(
              (token) =>
                token.tokenType === Identifier &&
                token.identifierKind !== IdentifierKind.Unassignable &&
                token.identifier === source.identifier &&
                token.scope === source.scope,
            )
          : tokens.filter(
              (token) =>
                token.tokenType === Identifier &&
                token.identifierKind !== IdentifierKind.Unassignable &&
                token.identifier === source.identifier &&
                !isLocal(tokens, token),
            );
      case FindKind.Definition:
        return isLocal(tokens, source)
          ? tokens.filter(
              (token) =>
                token.kind === TokenKind.Assignment &&
                token.identifierKind !== IdentifierKind.Unassignable &&
                token.identifier === source.identifier &&
                token.scope === source.scope,
            )
          : tokens.filter(
              (token) =>
                token.kind === TokenKind.Assignment &&
                token.identifierKind !== IdentifierKind.Unassignable &&
                token.identifier === source.identifier &&
                !isLocal(tokens, token),
            );
      case FindKind.Completion:
        const completions: Token[] = [];
        tokens
          .filter(
            (token) =>
              token.kind === TokenKind.Assignment &&
              token.identifierKind !== IdentifierKind.Unassignable &&
              (token.identifier?.startsWith(".") ||
                token.namespace === source.namespace) &&
              (!token.scope || token.scope === source.scope),
          )
          .forEach(
            (token) =>
              !completions.find(
                (item) => item.identifier === token.identifier,
              ) && completions.push(token),
          );
        return completions;
    }
  }
}
