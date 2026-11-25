// relationship.js (MIT, github.com/mumuy/relationship) ships no types; used only by tests
declare module 'relationship.js' {
  interface Options {
    text: string;
    target?: string;
    sex?: 0 | 1 | -1;
    type?: 'default' | 'chain' | 'pair';
    reverse?: boolean;
    mode?: string;
    optimal?: boolean;
  }
  const relationship: (options: Options) => string[];
  export default relationship;
}
