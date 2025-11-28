import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as migrator from '#root/services/migrator.js';

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
  for (const model of Object.values(models)) {
    console.log(`Checking seed for model: ${model.name}`);
    if (typeof model.seed === 'function') {
      console.log(`Seeding ${model.name}...`);
      await model.seed();
    }
  }
}
export default {
  init: async function init() {
    for (const file of fs.readdirSync(__dirname)) {
      if (!file.endsWith('.js') || file === 'init-models.js') continue;
      const modulePath = path.join(__dirname, file);
      const { default: Model } = await import(modulePath);
      models[Model.name] = Model;
    }
    const registeredModels = initRelations();
    await migrator.up();
    const isTestEnv =
      process.env.NODE_ENV === 'test' || process.env.ENVIRONMENT === 'test';
    if (!isTestEnv) await seedModels(registeredModels);
    return registeredModels;
  },
};
