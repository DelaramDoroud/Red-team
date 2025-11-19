import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as migrator from '#root/services/migrator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const models = {};
export function initRelations() {
  Object.values(models).forEach((model) => {
    if (typeof model.initializeRelations === 'function')
      model.initializeRelations(models);
  });
  return models;
}

export async function seedModels() {
  for (const model of Object.values(models))
    if (typeof model.seed === 'function') await model.seed();
}
export default {
  init: async function init() {
    for (const file of fs.readdirSync(__dirname)) {
      if (!file.endsWith('.mjs') || file === 'init-models.mjs') continue;
      const modulePath = path.join(__dirname, file);
      const { default: Model } = await import(modulePath);
      models[Model.name] = Model;
    }
    const registeredModels = initRelations();
    await migrator.up();
    await seedModels(registeredModels);
    return registeredModels;
  },
};
