import { C, INTERNAL, Internal, assertInternal, SIZE_OF_INT, SIZE_OF_SHORT } from './constants';
import { LookaheadIterator } from './lookahead_iterator';
import { unmarshalLanguageMetadata } from './marshal';
import { TRANSFER_BUFFER } from './parser';
import { Query } from './query';

const LANGUAGE_FUNCTION_REGEX = /^tree_sitter_\w+$/;

export class LanguageMetadata {
  readonly major_version: number;
  readonly minor_version: number;
  readonly patch_version: number;
}

/**
 * An opaque object that defines how to parse a particular language.
 * The code for each `Language` is generated by the Tree-sitter CLI.
 */
export class Language {
  /** @internal */
  private [0] = 0; // Internal handle for WASM

  /**
   * A list of all node types in the language. The index of each type in this
   * array is its node type id.
   */
  types: string[];

  /**
   * A list of all field names in the language. The index of each field name in
   * this array is its field id.
   */
  fields: (string | null)[];

  /** @internal */
  constructor(internal: Internal, address: number) {
    assertInternal(internal);
    this[0] = address;
    this.types = new Array<string>(C._ts_language_symbol_count(this[0]));
    for (let i = 0, n = this.types.length; i < n; i++) {
      if (C._ts_language_symbol_type(this[0], i) < 2) {
        this.types[i] = C.UTF8ToString(C._ts_language_symbol_name(this[0], i));
      }
    }
    this.fields = new Array<string>(C._ts_language_field_count(this[0]) + 1);
    for (let i = 0, n = this.fields.length; i < n; i++) {
      const fieldName = C._ts_language_field_name_for_id(this[0], i);
      if (fieldName !== 0) {
        this.fields[i] = C.UTF8ToString(fieldName);
      } else {
        this.fields[i] = null;
      }
    }
  }


  /**
   * Gets the name of the language.
   */
  get name(): string | null {
    const ptr = C._ts_language_name(this[0]);
    if (ptr === 0) return null;
    return C.UTF8ToString(ptr);
  }

  /**
   * @deprecated since version 0.25.0, use {@link Language#abiVersion} instead
   * Gets the version of the language.
   */
  get version(): number {
    return C._ts_language_version(this[0]);
  }

  /**
   * Gets the ABI version of the language.
   */
  get abiVersion(): number {
    return C._ts_language_abi_version(this[0]);
  }

  /**
  * Get the metadata for this language. This information is generated by the
  * CLI, and relies on the language author providing the correct metadata in
  * the language's `tree-sitter.json` file.
  */
  get metadata(): LanguageMetadata | null {
    C._ts_language_metadata(this[0]);
    const length = C.getValue(TRANSFER_BUFFER, 'i32');
    const address = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32');
    if (length === 0) return null;
    return unmarshalLanguageMetadata(address);
  }

  /**
   * Gets the number of fields in the language.
   */
  get fieldCount(): number {
    return this.fields.length - 1;
  }

  /**
   * Gets the number of states in the language.
   */
  get stateCount(): number {
    return C._ts_language_state_count(this[0]);
  }

  /**
   * Get the field id for a field name.
   */
  fieldIdForName(fieldName: string): number | null {
    const result = this.fields.indexOf(fieldName);
    return result !== -1 ? result : null;
  }

  /**
   * Get the field name for a field id.
   */
  fieldNameForId(fieldId: number): string | null {
    return this.fields[fieldId] ?? null;
  }

  /**
   * Get the node type id for a node type name.
   */
  idForNodeType(type: string, named: boolean): number | null {
    const typeLength = C.lengthBytesUTF8(type);
    const typeAddress = C._malloc(typeLength + 1);
    C.stringToUTF8(type, typeAddress, typeLength + 1);
    const result = C._ts_language_symbol_for_name(this[0], typeAddress, typeLength, named ? 1 : 0);
    C._free(typeAddress);
    return result || null;
  }

  /**
   * Gets the number of node types in the language.
   */
  get nodeTypeCount(): number {
    return C._ts_language_symbol_count(this[0]);
  }

  /**
   * Get the node type name for a node type id.
   */
  nodeTypeForId(typeId: number): string | null {
    const name = C._ts_language_symbol_name(this[0], typeId);
    return name ? C.UTF8ToString(name) : null;
  }

  /**
   * Check if a node type is named.
   *
   * @see {@link https://tree-sitter.github.io/tree-sitter/using-parsers/2-basic-parsing.html#named-vs-anonymous-nodes}
   */
  nodeTypeIsNamed(typeId: number): boolean {
    return C._ts_language_type_is_named_wasm(this[0], typeId) ? true : false;
  }

  /**
   * Check if a node type is visible.
   */
  nodeTypeIsVisible(typeId: number): boolean {
    return C._ts_language_type_is_visible_wasm(this[0], typeId) ? true : false;
  }

  /**
   * Get the supertypes ids of this language.
   *
   * @see {@link https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types.html?highlight=supertype#supertype-nodes}
   */
  get supertypes(): number[] {
    C._ts_language_supertypes_wasm(this[0]);
    const count = C.getValue(TRANSFER_BUFFER, 'i32');
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32');
    const result = new Array<number>(count);

    if (count > 0) {
      let address = buffer;
      for (let i = 0; i < count; i++) {
        result[i] = C.getValue(address, 'i16');
        address += SIZE_OF_SHORT;
      }
    }

    return result;
  }

  /**
   * Get the subtype ids for a given supertype node id.
   */
  subtypes(supertype: number): number[] {
    C._ts_language_subtypes_wasm(this[0], supertype);
    const count = C.getValue(TRANSFER_BUFFER, 'i32');
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32');
    const result = new Array<number>(count);

    if (count > 0) {
      let address = buffer;
      for (let i = 0; i < count; i++) {
        result[i] = C.getValue(address, 'i16');
        address += SIZE_OF_SHORT;
      }
    }

    return result;
  }

  /**
   * Get the next state id for a given state id and node type id.
   */
  nextState(stateId: number, typeId: number): number {
    return C._ts_language_next_state(this[0], stateId, typeId);
  }

  /**
   * Create a new lookahead iterator for this language and parse state.
   *
   * This returns `null` if state is invalid for this language.
   *
   * Iterating {@link LookaheadIterator} will yield valid symbols in the given
   * parse state. Newly created lookahead iterators will return the `ERROR`
   * symbol from {@link LookaheadIterator#currentType}.
   *
   * Lookahead iterators can be useful for generating suggestions and improving
   * syntax error diagnostics. To get symbols valid in an `ERROR` node, use the
   * lookahead iterator on its first leaf node state. For `MISSING` nodes, a
   * lookahead iterator created on the previous non-extra leaf node may be
   * appropriate.
   */
  lookaheadIterator(stateId: number): LookaheadIterator | null {
    const address = C._ts_lookahead_iterator_new(this[0], stateId);
    if (address) return new LookaheadIterator(INTERNAL, address, this);
    return null;
  }

  /**
   * @deprecated since version 0.25.0, call `new` on a {@link Query} instead
   *
   * Create a new query from a string containing one or more S-expression
   * patterns.
   *
   * The query is associated with a particular language, and can only be run
   * on syntax nodes parsed with that language. References to Queries can be
   * shared between multiple threads.
   *
   * @link {@see https://tree-sitter.github.io/tree-sitter/using-parsers/queries}
   */
  query(source: string): Query {
    console.warn('Language.query is deprecated. Use new Query(language, source) instead.');
    return new Query(this, source);
  }

  /**
   * Load a language from a WebAssembly module.
   * The module can be provided as a path to a file or as a buffer.
   */
  static async load(input: string | Uint8Array): Promise<Language> {
    let bytes: Promise<Uint8Array>;
    if (input instanceof Uint8Array) {
      bytes = Promise.resolve(input);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (globalThis.process?.versions.node) {
        const fs: typeof import('fs/promises') = await import('fs/promises');
        bytes = fs.readFile(input);
      } else {
        bytes = fetch(input)
          .then((response) => response.arrayBuffer()
            .then((buffer) => {
              if (response.ok) {
                return new Uint8Array(buffer);
              } else {
                const body = new TextDecoder('utf-8').decode(buffer);
                throw new Error(`Language.load failed with status ${response.status}.\n\n${body}`);
              }
            }));
      }
    }

    const mod = await C.loadWebAssemblyModule(await bytes, { loadAsync: true });
    const symbolNames = Object.keys(mod);
    const functionName = symbolNames.find((key) => LANGUAGE_FUNCTION_REGEX.test(key) &&
      !key.includes('external_scanner_'));
    if (!functionName) {
        console.log(`Couldn't find language function in WASM file. Symbols:\n${JSON.stringify(symbolNames, null, 2)}`);
        throw new Error('Language.load failed: no language function found in WASM file');
    }
    const languageAddress = mod[functionName]();
    return new Language(INTERNAL, languageAddress);
  }
}
