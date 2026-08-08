# Gera os ícones do PWA do cliente a partir da logo da GR7.
#
# Rodar só quando a arte da marca mudar: `powershell -File scripts/gerar-icones-pwa.ps1`.
# Está versionado para os PNG em public/ não virarem arquivos de origem
# desconhecida, que ninguém sabe regerar quando a logo for atualizada.
#
# Depende de System.Drawing (Windows). Em outro sistema, usar qualquer editor
# respeitando as proporções descritas abaixo.
#
# Fundo sólido em #0d0f13 (token sf-0 do tema): a logo é branca com transparência,
# e ícone transparente no Windows e no Android aparece sobre fundo claro do sistema,
# onde ela sumiria.
#
# Duas famílias:
#   any       — o ícone como é desenhado. Logo a 70% da largura.
#   maskable  — o Android recorta em círculo/squircle. A logo cabe em ~58% da
#               largura, então a diagonal fica dentro da zona segura de 80%.

Add-Type -AssemblyName System.Drawing

$origem = "C:\Users\PABLLO\Desktop\projeto\atendimento-gr7\public\marca-gr7.png"
$destino = "C:\Users\PABLLO\Desktop\projeto\atendimento-gr7\public"
$fundo = [System.Drawing.ColorTranslator]::FromHtml("#0d0f13")

$logo = [System.Drawing.Image]::FromFile($origem)
$razao = $logo.Width / $logo.Height

function Gerar($lado, $proporcao, $arquivo) {
    $bmp = New-Object System.Drawing.Bitmap($lado, $lado)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($fundo)

    $largura = [Math]::Round($lado * $proporcao)
    $altura = [Math]::Round($largura / $script:razao)
    $x = [Math]::Round(($lado - $largura) / 2)
    $y = [Math]::Round(($lado - $altura) / 2)
    $g.DrawImage($script:logo, $x, $y, $largura, $altura)

    $g.Dispose()
    $caminho = Join-Path $destino $arquivo
    $bmp.Save($caminho, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    "$arquivo  ${lado}x${lado}  logo ${largura}x${altura}"
}

Gerar 192 0.70 "icone-192.png"
Gerar 512 0.70 "icone-512.png"
Gerar 512 0.58 "icone-maskable-512.png"
# iOS não lê o manifest para o ícone da tela inicial: usa apple-touch-icon.
Gerar 180 0.70 "apple-touch-icon.png"

$logo.Dispose()
