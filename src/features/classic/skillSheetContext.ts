import { createContext, useContext } from 'react';

/** Set by SkillSheetHost on a build page; opens its skill sheet for a skill of that build, by name. */
export const OpenSkill = createContext<(skill: string) => void>(() => {});

/** Opens the skill sheet for one of the current build's skills (by name); does nothing outside a build page. */
export const useOpenSkill = () => useContext(OpenSkill);
