import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AvailabilityState {
  isOnline: boolean;
  currentLocation: {
    lat: number;
    lng: number;
  } | null;
}

const initialState: AvailabilityState = {
  isOnline: false,
  currentLocation: null,
};

const availabilitySlice = createSlice({
  name: 'availability',
  initialState,
  reducers: {
    setOnline(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },
    updateLocation(state, action: PayloadAction<{ lat: number; lng: number }>) {
      state.currentLocation = action.payload;
    },
  },
});

export const { setOnline, updateLocation } = availabilitySlice.actions;
export default availabilitySlice.reducer;
