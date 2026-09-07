declare module 'ical.js' {
  export interface ICALEvent {
    summary: string;
    description: string;
    endDate?: {
      toJSDate: () => Date;
    };
    startDate?: {
      toJSDate: () => Date;
    };
  }

  export interface ICALComponent {
    getAllSubcomponents: (name: string) => unknown[];
  }

  const ICAL: {
    parse: (input: string) => unknown;
    Component: new (parsed: unknown) => ICALComponent;
    Event: new (component: unknown) => ICALEvent;
  };

  export default ICAL;
}