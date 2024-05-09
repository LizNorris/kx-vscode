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

import { Position, Range } from "vscode-languageserver";
import { Token, TokenKind } from "../parser";

export function rangeFromToken(token: Token): Range {
  return Range.create(
    (token.startLine || 1) - 1,
    (token.startColumn || 1) - 1,
    (token.endLine || 1) - 1,
    token.endColumn || 1,
  );
}

export function isLocal(tokens: Token[], target: Token) {
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

export function positionToToken(tokens: Token[], position: Position) {
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

export function getLabel(token: Token, source?: Token): string {
  const label = token.identifier || token.image;

  if (source?.namespace) {
    if (label.startsWith(source.namespace)) {
      return label.replace(`${source.namespace}.`, "");
    }
  }

  return label;
}
