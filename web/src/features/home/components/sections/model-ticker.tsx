/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useTranslation } from 'react-i18next'

// Real model names stay identical across languages, so they are not translated.
const MODEL_NAMES = [
  'GPT-4o',
  'Claude 4 Sonnet',
  'Gemini 2.5 Pro',
  'Qwen-Max',
  'DeepSeek-V3',
  'ERNIE 5.0',
  'Hunyuan-Turbo',
  'Llama 4 70B',
  'Embed-v4',
]

const NOTE_KEYS = [
  '128+ models and counting',
  'OpenAI-compatible protocol',
  'Smart routing · millisecond billing',
]

function TickerSet() {
  const { t } = useTranslation()

  return (
    <div className='flex shrink-0 items-center gap-9 pr-9'>
      {MODEL_NAMES.map((name) => (
        <span
          key={name}
          className='flex items-center gap-2.5 text-xs font-medium tracking-wide whitespace-nowrap text-white/95'
        >
          <i
            aria-hidden
            className='size-1.5 rotate-45 rounded-[1px] bg-white/70'
          />
          {name}
        </span>
      ))}
      {NOTE_KEYS.map((key) => (
        <span
          key={key}
          className='flex items-center gap-2.5 text-xs font-medium tracking-wide whitespace-nowrap text-white/60'
        >
          <i
            aria-hidden
            className='size-1.5 rotate-45 rounded-[1px] bg-white/45'
          />
          {t(key)}
        </span>
      ))}
    </div>
  )
}

export function ModelTicker() {
  return (
    <div
      aria-hidden
      className='landing-marquee relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 py-3.5'
    >
      <div className='landing-marquee-track flex w-max items-center'>
        <TickerSet />
        <TickerSet />
      </div>
    </div>
  )
}
