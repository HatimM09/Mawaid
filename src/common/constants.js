// src/common/constants.js
// Single source of truth for hardcoded default values shared across admin & member.

/** Default weekly menu used when no `weekly_menu` row has been published yet. */
export const DEFAULT_MENU = {
  monday:    { lunch: 'Chola, Kulcha, Shreekhand, Dal, Chawal', dinner: 'FMB Menu' },
  tuesday:   { lunch: 'American Choupsey, Wafers, Butter Khichdi', dinner: 'Roti, Veg Jaipuri, Chicken Pulao, Soup' },
  wednesday: { lunch: 'Vegetable Sandwich, Bhel Salad, Corn Pulao', dinner: 'Roti, White Chicken, Manchurian Rice, Gravy' },
  thursday:  { lunch: 'Chicken 65, Corn Munch Salad, Dal Makhni, Chawal', dinner: 'Roti, Mango Custard, Matar Paneer, Tuwar Pulao, Palidu' },
  friday:    { lunch: 'FMB Menu', dinner: 'Roti, Gobi Matar, Chicken Kashmiri Pulao, Soup' },
  saturday:  { lunch: 'Chana Bateta, Dal Makhni, Chawal', dinner: 'Roti, Chicken Tarkari, Veg Coconut Rice, Kung Pao Gravy' },
}

/** Default app settings when no `app_settings` rows exist. */
export const DEFAULT_APP_SETTINGS = {
  survey_msg: 'Survey opens Saturday at 8:00 PM and closes Monday at 11:00 AM.',
  survey_open_hour: '20',
  survey_close_hour: '11',
  lunch_edit_open: '20:00',
  lunch_edit_close: '11:00',
  dinner_edit_open: '12:00',
  dinner_edit_close: '15:30',
}
