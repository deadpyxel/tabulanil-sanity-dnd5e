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
    INSANITY_TIER: "insanityTier",
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
  * @returns {Promise} A Promise that resolves when the actor's Sanity flag is updated.
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
  *
  * @param {string} actorId - The unique identifier for the actor whose sanity we want to update
  * @param {number} value - The value to adjust the actor's sanity to.
  * @returns {Promise} A Promise that resolves when the actor's Current Sanity flag is updated.
  */
  static updateSanityForActor(actorId, value) {
    const relatedActor = game.actors.get(actorId);
    if (relatedActor !== undefined) {
      return relatedActor.setFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.CURRENT_SANITY, value);
    }
  }

  /**
  * Gets the current Sanity points for the specified actor.
  *
  * @param {string} actorId - The unique identifier for the actor whose sanity we want to update
  * @returns {number|null} The current Sanity Points of the actor if available, or null otherwise
  */
  static getSanityForActor(actorId) {
    const relatedActor = game.actors.get(actorId);
    if (relatedActor !== undefined) {
      return relatedActor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.CURRENT_SANITY);
    }
    return null;
  }

  /**
  * Gets the Total Sanity score for the specified actor.
  *
  * @param {string} actorId - The unique identifier for the actor whose sanity we want to update
  * @returns {number|null} The current Total Sanity Points of the actor if available, or null otherwise
  */
  static getTotalSanityForActor(actorId) {
    const relatedActor = game.actors.get(actorId);
    if (relatedActor !== undefined) {
      return relatedActor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.SANITY_POOL);
    }
    return null;
  }
  /**
  * Gets the current insanity tier for the specified actor.
  *
  * @param {string} actorId - The unique identifier for the actor whose sanity we want to update
  * @returns {number|null} The current insanity tier of the actor if available, or null otherwise
  */
  static getInsanityTierForActor(actorId) {
    const relatedActor = game.actors.get(actorId);
    if (relatedActor !== undefined) {
      return relatedActor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.INSANITY_TIER);
    }
    return null;
  }
  /**
  * Updates the insanity tier for a specified actor.
  *
  * @param {string} actorId - The unique identifier for the actor whose insanity tier we want to update
  * @returns {Promise} A Promise that resolves when the actor's Insanity Tier flag is updated.
  */
  static updateCurrentInsanityTierForActor(actorId) {
    const relatedActor = game.actors.get(actorId);
    if (relatedActor !== undefined) {
      const currSan = relatedActor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.CURRENT_SANITY);
      const totalSan = relatedActor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.SANITY_POOL);
      const sanityTier = this.calcSanityTier(totalSan, [0.8, 0.6, 0.4, 0.2, 0.1, 0.0], currSan);
      TabulanilSanity.log(false, `Current Insanity Tier for actor ${relatedActor.name}[${actorId}]: ${sanityTier}`);
      return relatedActor.setFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.INSANITY_TIER, sanityTier);
    }
  }

  /**
   * Calculates the sanity tier based on the provided base value, a lost of coefficients and the current value.
   * The function determines the highest applicable tier where the current value is greater then or equal the
   * base value multiplied by the coefficient of that tier. It returns the tier number starting from 1.
   * If the current value is greater than the first tier or equal to the base value, returns 0.
   *
   * @param {number} baseVal - The base value for sanity calculation.
   * @param {Array<number>} coef - An array of coefficients used to determine tier thresholds for sanity.
   * @param {number} currVal - The current sanity value to be compared.
   * @returns {number} The 1-based index of the highest matching tier or 0 if no tier is valid
   */
  static calcSanityTier(baseVal, coef, currVal) {
    // IF the current value is same as base value, imply no tier was found
    if (baseVal === currVal) {
      return 0;
    }
    // Define a safe default for current tier and iterate of the coefficients
    let currTier = 0;
    for (let i = 0; i < coef.length; i++) {
      // Calculate the threshold for this tier
      const tierVal = Math.floor(baseVal * coef[i])
      // if the current value is greater than the current tier threhold, break out of the loop
      if (currVal > tierVal) {
        break;
      }
      // Update the current matching tier
      currTier = i + 1;
    }
    // Return the tier found, or 0 if no matching tier was found.
    return currTier;
  }
}

/**
  * Registers a debug flag for the module once the developer mode is ready.
  * This is useful for enabling or disabling debug output conditionally based on the environment.
  */
Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(TabulanilSanity.ID);
});
