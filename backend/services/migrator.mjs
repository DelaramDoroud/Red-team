import logger from '#root/services/logger.mjs';
import { Umzug, SequelizeStorage } from 'umzug';
import sequelize from '#root/services/sequelize.mjs';

const initMigrator = () =>
  new Umzug({
    migrations: { glob: 'migrations/*.js' },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
  });

const up = async () => {
  try {
    const migrator = initMigrator();
    const result = await migrator.up();
    logger.debug(
      `Migrated ${result.length} file${result.length === 1 ? '' : 's'}`
    );
  } catch (e) {
    logger.error(e);
    logger.error(e.message);
  }
};

const down = async () => {
  try {
    const migrator = initMigrator();
    const result = await migrator.down();
    logger.debug(
      `Rolled back ${result.length} file${result.length === 1 ? '' : 's'}`
    );
  } catch (e) {
    logger.error(e);
    logger.error(e.message);
  }
};
const downAll = async () => {
  try {
    const migrator = initMigrator();
    const result = await migrator.down({ to: 0 });
    logger.debug(
      `Rolled back ${result.length} file${result.length === 1 ? '' : 's'}`
    );
  } catch (e) {
    logger.error(e);
    logger.error(e.message);
  }
};
export { up, down, downAll };
