import { create } from 'zustand';

interface Channel {
  id: string;
  name: string;
  type: 'DM' | 'GROUP' | 'PROJECT';
  description?: string;
  projectId?: string;
  members?: any[];
  _count?: { members: number; messages: number };
}

interface ChatStore {
  channels: Channel[];
  activeChannelId: string | null;
  setChannels: (channels: Channel[]) => void;
  setActiveChannel: (channelId: string | null) => void;
  addChannel: (channel: Channel) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  channels: [],
  activeChannelId: null,
  setChannels: (channels) => set({ channels }),
  setActiveChannel: (activeChannelId) => set({ activeChannelId }),
  addChannel: (channel) =>
    set((state) => ({ channels: [channel, ...state.channels] })),
}));
