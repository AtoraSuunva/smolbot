import { SleetSlashCommandGroup } from 'sleetcord'
import { modmail_fields_add } from './add.js'
import { modmail_fields_edit } from './edit.js'
import { modmail_fields_remove } from './remove.js'
import { modmail_fields_view } from './view.js'

export const modmail_fields = new SleetSlashCommandGroup({
  name: 'fields',
  description: 'Manage modmail fields',
  options: [
    modmail_fields_add,
    modmail_fields_remove,
    modmail_fields_edit,
    modmail_fields_view,
  ],
})
