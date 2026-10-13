/**
 * Client-safe view model for the project form's client selector. Contains no
 * organization identifier: the tenant is always resolved server-side.
 */
export type ClientOption = {
  id: string;
  name: string;
};
