import { invokeMigration } from './migration';
import * as macros from './macros';
import AdvancementManager from './advancement';

/**
 * Global utility functions, exposed to users via
 * cosmereRPG.utils
 */

export default {
    invokeMigration,
    macros,
    AdvancementManager,
};
