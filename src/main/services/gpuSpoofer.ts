export interface GpuIdentity {
  vendor: string;
  renderer: string;
  version: string;
}

/**
 * @deprecated GpuSpoofer foi substituído pela imagem oficial Geenjutsu Android Stealth Appliance.
 * As bibliotecas gráficas (libGLESv2_mesa.so e libgallium_dri.so) já vêm compiladas nativamente
 * reportando Samsung / Samsung Xclipse 920 com zero vazamento de hardware do host e sem montagem de volumes .so.
 */
export class GpuSpoofer {
  static resolveGpuIdentity(_device?: {
    brand?: string;
    board?: string;
    gpu?: string;
    model?: string;
  }): GpuIdentity {
    return {
      vendor: 'Samsung',
      renderer: 'Samsung Xclipse 920',
      version: 'OpenGL ES 3.2 v1.r38p1-01eac0',
    };
  }

  static prepareProfileGpuOverrides(
    _profile: { id: string; name?: string; device?: any },
    _baseMesaPath: string | null,
    _baseGles2Path: string | null,
    _outputDir: string
  ): { mesaPath?: string; gles2Path?: string } | null {
    // Zero-config stealth appliance já possui GPU blindada nativamente na imagem
    return null;
  }
}
