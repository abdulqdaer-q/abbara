/**
 * Mock implementation of superjson for Jest tests
 * Provides basic serialization/deserialization without the ES module issues
 */
const superjson = {
  serialize: (data: any) => ({ json: data, meta: undefined }),
  deserialize: ({ json }: any) => json,
  parse: (str: string) => JSON.parse(str),
  stringify: (obj: any) => JSON.stringify(obj),
};

export default superjson;
