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

import * as assert from "assert";
import { generateTextMateGrammar, parse } from "../../server/src/parser";
import { lint } from "../../server/src/linter";

describe("QParser", () => {
  describe("language", () => {
    it("should generate TextMate grammar file", () => {
      assert.ok(generateTextMateGrammar());
    });
  });
});

describe("TSQLint", () => {
  it("should lint deprecatedDatetime", () => {
    const text = "2000.01.01T12:00:00.000";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "DEPRECATED_DATETIME");
  });
  it("should lint assignReservedWord", () => {
    const text = "if:1";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "ASSIGN_RESERVED_WORD");
  });
  it("should lint invalidAssign", () => {
    const text = '100:1;`a :1;"":1';
    const result = lint(parse(text));
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].code, "INVALID_ASSIGN");
    assert.strictEqual(result[1].code, "INVALID_ASSIGN");
    assert.strictEqual(result[2].code, "INVALID_ASSIGN");
  });
  it("should lint fixedSeed", () => {
    const text = "1?0Ng";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "FIXED_SEED");
  });
  it("should lint invalidEscape", () => {
    const text = '"\\378"';
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "INVALID_ESCAPE");
  });
  it("should lint unusedParam", () => {
    const text = "{[a]a:1}";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "UNUSED_PARAM");
  });
  it("should lint unusedVar", () => {
    const text = "a:1";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "UNUSED_VAR");
  });
  it("should lint declaredAfterUse", () => {
    const text = "a;a:1;(b:1;b);[b:1;b]";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].code, "DECLARED_AFTER_USE");
    assert.strictEqual(result[1].code, "DECLARED_AFTER_USE");
    assert.strictEqual(result[2].code, "DECLARED_AFTER_USE");
  });
});
