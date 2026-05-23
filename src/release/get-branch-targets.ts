import { AppContext } from "../app-context"

export const getBaseBranch = (ctx: AppContext) => ctx.base_branch

export const getPushBranch = (ctx: AppContext) =>
  ctx.push_branch?.trim() || ctx.base_branch
