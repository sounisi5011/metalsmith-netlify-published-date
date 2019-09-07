import Metalsmith from 'metalsmith';
import util from 'util';

export async function buildAsync(
    metalsmith: Metalsmith,
): Promise<Metalsmith.Files> {
    return util.promisify(metalsmith.build.bind(metalsmith))();
}

export async function processAsync(
    metalsmith: Metalsmith,
): Promise<Metalsmith.Files> {
    return util.promisify(metalsmith.process.bind(metalsmith))();
}
