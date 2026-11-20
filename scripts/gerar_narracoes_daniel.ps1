# Requer PowerShell 7 no Windows, Microsoft Daniel e FFmpeg.
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Saida
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$parabolas = Join-Path (Split-Path $PSScriptRoot) 'PARABOLAS'
$roteiros = Get-Content -LiteralPath (Join-Path $parabolas 'narracoes.json') -Raw -Encoding utf8 |
    ConvertFrom-Json -AsHashtable
$pastaAudio = Join-Path $Saida 'audio'
New-Item -ItemType Directory -Path $pastaAudio -Force | Out-Null
$wav = Join-Path $Saida ('daniel-{0}.wav' -f [guid]::NewGuid())
$separador = [string][char]10 + [char]10
$dados = [ordered]@{}

Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies @([System.Speech.Synthesis.SpeechSynthesizer].Assembly.Location, 'System.Collections') -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Speech.AudioFormat;
using System.Speech.Synthesis;

public static class NarracaoDaniel {
    public static int[][] Gravar(string texto, string arquivo) {
        var marcas = new List<int[]>();
        using (var voz = new SpeechSynthesizer()) {
            voz.SelectVoice("Microsoft Daniel");
            var formato = new SpeechAudioFormatInfo(16000, AudioBitsPerSample.Sixteen, AudioChannel.Mono);
            voz.SpeakProgress += (origem, palavra) => marcas.Add(new int[] {
                (int)Math.Round(palavra.AudioPosition.TotalMilliseconds),
                palavra.CharacterPosition,
                palavra.CharacterCount
            });
            voz.SetOutputToWaveFile(arquivo, formato);
            voz.Speak(texto);
        }
        return marcas.ToArray();
    }
}
'@

function Medir-Ganho([string]$Arquivo) {
    $linhas = ffmpeg -hide_banner -nostdin -i $Arquivo -af 'loudnorm=I=-18.6:TP=-1.5:LRA=15:print_format=json' -f null - 2>&1 |
        ForEach-Object { $_.ToString() }
    $json = [regex]::Match(($linhas -join [char]10), '(?s)\{\s*"input_i"\s*:.*?\}')
    if (!$json.Success) { throw 'O FFmpeg não retornou a medição do áudio.' }
    $medidas = $json.Value | ConvertFrom-Json
    $cultura = [Globalization.CultureInfo]::InvariantCulture
    $volume = [double]::Parse($medidas.input_i, $cultura)
    $pico = [double]::Parse($medidas.input_tp, $cultura)
    return [Math]::Min(-18.64 - $volume, -1.5 - $pico).ToString('0.000', $cultura)
}

try {
    foreach ($slug in $roteiros.Keys) {
        if ($slug -cnotmatch '^[a-z0-9-]+$') { throw "Identificador inválido: $slug" }
        $cenas = $roteiros[$slug]
        $marcas = [NarracaoDaniel]::Gravar(($cenas -join $separador), $wav)
        $mp3 = Join-Path $pastaAudio "$slug.mp3"
        $ganho = Medir-Ganho $wav
        ffmpeg -v error -nostdin -y -i $wav -af ('volume={0}dB' -f $ganho) -ar 24000 -ac 1 -c:a libmp3lame -b:a 160k -map_metadata -1 $mp3
        $inicio = 0
        $quadros = @(
            for ($i = 0; $i -lt $cenas.Count; $i++) {
                $texto = $cenas[$i]
                $palavras = @(
                    foreach ($marca in $marcas) {
                        $posicao = $marca[1] - $inicio
                        if ($posicao -ge 0 -and $posicao -lt $texto.Length) {
                            ,@($marca[0], $posicao, $marca[2])
                        }
                    }
                )
                if (!$palavras.Count) { throw "Nenhuma marca no quadro $($i + 1) de $slug." }
                $inicio += $texto.Length + $separador.Length
                $tempo = if ($i -eq 0) { 0 } else { $palavras[0][0] }
                ,@($tempo, $texto, $palavras)
            }
        )
        $hash = (Get-FileHash -LiteralPath $mp3).Hash.Substring(0, 12).ToLowerInvariant()
        $dados[$slug] = [ordered]@{ audio = "audio/$slug.mp3?v=$hash"; quadros = $quadros }
        Write-Output "Narrada $slug ($($quadros.Count) quadros)"
    }
    $json = ConvertTo-Json -InputObject $dados -Depth 12 -Compress
    Set-Content -LiteralPath (Join-Path $Saida 'dados-narracoes.js') -Value "window.BIBLIE_NARRACOES = $json;" -Encoding utf8NoBOM
} finally {
    Remove-Item -LiteralPath $wav -ErrorAction SilentlyContinue
}
