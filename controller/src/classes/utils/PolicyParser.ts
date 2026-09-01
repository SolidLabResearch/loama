import { DataFactory, Parser, Store } from "n3";

const { namedNode } = DataFactory

export const ODRL = (something: string) => namedNode(`http://www.w3.org/ns/odrl/2/${something}`);
export const OVC = (something: string) => namedNode(`https://w3id.org/gaia-x/ovc/1/${something}`);

export class PolicyParser {

    public constructor() { }

    public parseText = (text: string): Store => {
        const parser = new Parser({ format: 'text/turtle' });
        const quads = parser.parse(text);
        return new Store(quads);
    }
}
