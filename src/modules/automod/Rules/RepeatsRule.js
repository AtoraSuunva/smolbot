const AutoProp = require('./AutoProp')
const Rule = require('./Rule')

/**
 * A rule to prevent a user repeating a message more than X times
 */
module.exports = class RepeatsRule extends Rule {
  /**
   * @param {string|number} id The id of this rule in the database
   * @param {String} punishment The punishment to apply
   * @param {Number} maxRepeats The max number a user can repeat their message
   * @param {Number} timeout The timeout (in seconds) before a violation expires
   * @param {String[]} ignore If a message starts with one of the strings, ignore it
   */
  constructor(id, punishment, maxRepeats, timeout, ignore = []) {
    super(id, 'repeats', punishment, maxRepeats, timeout, ignore)
    this.punishment = punishment
    this.maxRepeats = maxRepeats
    this.timeout = timeout * 1000
    this.parameters = ignore

    this.ignore = ignore.map(v => v.toLowerCase())
    this.lastMessage = {}
    this.violations = new Map()
    this.name = `Max repeats reached (${maxRepeats})`
  }

  filter(message) {
    const uid = message.guild.id + message.author.id
    const caught = this.violations.get(uid) || new Set()

    if (this.ignore.find(v => message.content.toLowerCase().startsWith(v))) {
      return
    }

    if (this.lastMessage[uid] && message.content === this.lastMessage[uid]) {
      // -1 because the first message isn't counted since it's not a repeat

      caught.add(message.id)

      if (caught.size >= this.maxRepeats - 1) {
        caught.clear()
        this.violations.set(uid, caught)
        return { punishment: this.punishment }
      }

      this.violations.set(uid, caught)

      setTimeout(() => {
        caught.delete(message.id)
        this.violations.set(uid, caught)
      }, this.timeout)
    }

    this.lastMessage[uid] = message.content
  }
}
