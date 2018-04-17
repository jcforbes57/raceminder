import _ from 'lodash';

import { CREATE_RACE, DELETE_RACE, CREATE_RACE_STOP, DELETE_RACE_STOP } from '../actions/index';

let initialState = localStorage.getItem('races') ? JSON.parse(localStorage.getItem('races')) : {};

export default function (state = initialState, action) {
  let newState = null;
  switch (action.type) {
    case CREATE_RACE: {
      let race = action.payload;
      let raceId = null;

      if (!race.id) {
        // need to create a random id
        raceId = _.size(state) + 1;
        race.id = raceId;
      } else {
        raceId = race.id;
      }

      newState = { ...state, [raceId]: race };
      localStorage.setItem('races', JSON.stringify(newState));
      return newState;
    }

    case DELETE_RACE: {
      newState = _.omit(state, action.payload);
      localStorage.setItem('races', JSON.stringify(newState));
      return newState;
    }

    case CREATE_RACE_STOP: {
      let { raceId, stop } = action.payload;

      // lookup the correct race
      let race = state[raceId];
      let stopId = null;
      if (!stop.id) {
        // create a stop id
        stopId = _.size(race.stops) + 1;
        stop.id = stopId;
      } else {
        stopId = stop.id;
      }

      // add the stop to the race
      newState = {
        ...state,
        // update our race object with the new stops array
        [raceId]: {
          ...race,
          stops: Object.assign({}, race.stops, { stopId: stop })
        }
      }

      console.log('state.races after adding stop:', newState);
      return newState;
    }

    case DELETE_RACE_STOP: {
      let { raceId, stopId } = action.payload;
      let race = state[raceId];

      let stops = _.omit(state[raceId].stops, stopId);
      newState = { 
        ...state, 
        [raceId]: {
          ...race,
          stops: stops
        }
      }

      //localStorage.setItem('races', JSON.stringify(newState));
      console.log('state.races after deleting stop:', newState);
      return newState;
    }

    default: {
      return state;
    }
  }
}