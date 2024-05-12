/**
  * Class representing the sanity system for the FoundryVTT module
  */
class TabulanilSanity {
  /**
  * The unique identifier for the module
  * @type {string}
  */
  static ID = "tabulanil-sanity-dnd5e";

  /**
  * Flags used within the module to maintain state
  * @type {Object}
  */
  static FLAGS = {
    SANITY_POOL: "totalSanity",
    CURRENT_SANITY: "currSanity",
    INSANITY_T1: "sanT1",
    INSANITY_T2: "sanT2",
    INSANITY_T3: "sanT3",
    INSANITY_T4: "sanT4",
    INSANITY_T5: "sanT5",
    INSANITY_T6: "sanT6",
  }
  
  /**
  * Paths to the Handlebars tempalte files used
  * @type {Object}
  */
  static TEMPLATES = {
    SANITYSHEET: `modules/${this.ID}/templates/sanity-system.hbs`
  }

  /**
  * Logs messages to the console if the debug mode is active or logging is forced.
  * @param {boolean} force - Force the function to log regardless of the debug settings
  * @param {...any} args - Additional arguments to log.
  */
  static log(force, ...args) {  
    const shouldLog = force || game.modules.get('_dev-mode')?.api?.getPackageDebugValue(this.ID);

    if (shouldLog) {
      console.log(this.ID, '|', ...args);
    }
  }
}

/**
  * Class responsible for managing sanity data computations for Actors
  */
class TabulanilSanityData {
  /**
  * Calculates the total sanity points for a specified Actor based on their mental ability scores.
  *
  * @param {string} actorId - The unique identifier for the actor whose sanity total we want to calculate
  * @returns {Promise} A PRomise that resolves when the actor's Sanity flag is updated.
  */
  static calcTotalSanityForActor(actorId) {
    const relatedActor = game.actors.get(actorId);
    if (relatedActor !== undefined) {
      const actorAbilities = relatedActor.system.abilities
      const totalSanity = (actorAbilities.cha.value + actorAbilities.int.value + actorAbilities.wis.value) * 2
      return relatedActor.setFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.SANITY_POOL, totalSanity);
    }
  }

  /**
  * Updates the sanity score for a specified actor.
  * TODO: This method is currently a placeholder and should be implemented to handle
  *
  * @param {string} actorId - The unique identifier for the actor whose sanity we want to update
  * @param {number} value - The value to adjust the actor's sanity to.
  */
  static updateSanityForActor(actorId, value) {}
}

/**
  * Registers a debug flag for the module once the developer mode is ready.
  * This is useful for enabling or disabling debug output conditionally based on the environment.
  */
Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(TabulanilSanity.ID);
});
