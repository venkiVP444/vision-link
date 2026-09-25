import { TTSLanguage } from '../../types';

export interface VoiceMetadata {
  code: TTSLanguage;
  name: string;
  nativeName: string;
  voiceName: string;
  isBundled: boolean;
  isOfflineNeural: boolean;
  sizeBytes: number;
  sizeMb: string;
  sha256: string; // Full 64-character hexadecimal SHA-256 hash
  sampleRate: number;
  downloadUrl?: string;
  uninstalledBadge: string;
  installedBadge: string;
  installRequirementNotice: string;
}

export const VOICE_REGISTRY: Record<TTSLanguage, VoiceMetadata> = {
  'ha-NG': {
    code: 'ha-NG',
    name: 'Hausa',
    nativeName: 'Hausa',
    voiceName: 'Malama Asabe (F4)',
    isBundled: true,
    isOfflineNeural: true,
    sizeBytes: 77063376,
    sizeMb: '73.5 MB',
    sha256: '7889E1A9E07CABF6E1CBEC4CE09D8EED49FC63BB729770F60DCB7DE2F1D34C74',
    sampleRate: 22050,
    uninstalledBadge: 'Bundled',
    installedBadge: 'OFFLINE NEURAL ✓ Ready',
    installRequirementNotice: 'Pre-installed in application bundle. 100% offline.',
  },
  'en-GB': {
    code: 'en-GB',
    name: 'English (UK)',
    nativeName: 'English',
    voiceName: 'Jenny Dioco (RP)',
    isBundled: true,
    isOfflineNeural: true,
    sizeBytes: 63201294,
    sizeMb: '60.3 MB',
    sha256: '469C630D209E139DD392A66BF4ABDE4AB86390A0269C1E47B4E5D7CE81526B01',
    sampleRate: 22050,
    uninstalledBadge: 'Bundled',
    installedBadge: 'OFFLINE NEURAL ✓ Ready',
    installRequirementNotice: 'Pre-installed in application bundle. 100% offline.',
  },
  'ar': {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    voiceName: 'Emirati Female',
    isBundled: false,
    isOfflineNeural: true,
    sizeBytes: 63516686,
    sizeMb: '60.6 MB',
    sha256: '1578A9B27D01A0626227225B148179628B770607DD61BDBBC41865BD399106B1',
    sampleRate: 22050,
    downloadUrl: 'https://huggingface.co/vadimbelsky/arabic-emirati-female-piper/resolve/main/arabic-emirati-female-model.onnx',
    uninstalledBadge: 'Voice Pack Required',
    installedBadge: 'OFFLINE NEURAL ✓ Ready',
    installRequirementNotice: 'Internet connection required for initial installation.',
  },
  'hi-IN': {
    code: 'hi-IN',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    voiceName: 'Priyamvada',
    isBundled: false,
    isOfflineNeural: true,
    sizeBytes: 63516050,
    sizeMb: '60.6 MB',
    sha256: 'AA63BCF2CD493B55A450F280E23CF77F03AFC9AF7015E6E5ACD43B652F166C88',
    sampleRate: 22050,
    downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/priyamvada/medium/hi_IN-priyamvada-medium.onnx',
    uninstalledBadge: 'Voice Pack Required',
    installedBadge: 'OFFLINE NEURAL ✓ Ready',
    installRequirementNotice: 'Internet connection required for initial installation.',
  },
  'en-US': {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English',
    voiceName: 'Jenny Dioco (RP Fallback)',
    isBundled: true,
    isOfflineNeural: true,
    sizeBytes: 63201294,
    sizeMb: '60.3 MB',
    sha256: '469C630D209E139DD392A66BF4ABDE4AB86390A0269C1E47B4E5D7CE81526B01',
    sampleRate: 22050,
    uninstalledBadge: 'Bundled',
    installedBadge: 'OFFLINE NEURAL ✓ Ready',
    installRequirementNotice: 'Pre-installed in application bundle. 100% offline.',
  },
};

export type VoicePackInstallState =
  | 'ready'
  | 'voice_pack_required'
  | 'downloading'
  | 'verifying'
  | 'error';

export interface VoicePackStatus {
  language: TTSLanguage;
  isBundled: boolean;
  isInstalled: boolean;
  state: VoicePackInstallState;
  badge: string;
  details: string;
  sha256: string;
  sizeMb: string;
}
