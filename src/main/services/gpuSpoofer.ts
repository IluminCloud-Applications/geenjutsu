import fs from 'fs';
import path from 'path';

export interface GpuIdentity {
  vendor: string;
  renderer: string;
  version: string;
}

export class GpuSpoofer {
  /**
   * Resolve a identidade realista da GPU correspondente ao modelo do dispositivo no catálogo.
   * Exemplo: Galaxy S21 Exynos -> ARM / Mali-G78 MP14
   * Galaxy S24 Ultra Snapdragon -> Qualcomm / Adreno (TM) 750
   */
  static resolveGpuIdentity(device?: {
    brand?: string;
    board?: string;
    gpu?: string;
    model?: string;
  }): GpuIdentity {
    const rawGpu = device?.gpu || '';
    const board = (device?.board || '').toLowerCase();

    // 1. Qualcomm Adreno
    if (
      rawGpu.toLowerCase().includes('adreno') ||
      board.includes('qualcomm') ||
      board.includes('kalama') ||
      board.includes('sun') ||
      board.includes('lahaina') ||
      board.includes('taro')
    ) {
      let renderer = rawGpu || 'Adreno (TM) 750';
      if (!renderer.includes('(TM)')) {
        renderer = renderer.replace(/Adreno\s*/i, 'Adreno (TM) ');
      }
      return {
        vendor: 'Qualcomm',
        renderer,
        version: 'OpenGL ES 3.2',
      };
    }

    // 2. Samsung Xclipse (Exynos 2200 / 2400)
    if (rawGpu.toLowerCase().includes('xclipse')) {
      return {
        vendor: 'Samsung Electronics Co., Ltd.',
        renderer: rawGpu,
        version: 'OpenGL ES 3.2',
      };
    }

    // 3. ARM Mali (Samsung Exynos, Google Tensor, MediaTek Dimensity)
    let renderer = rawGpu || 'Mali-G78 MP14';
    if (!renderer.toLowerCase().includes('mali')) {
      renderer = 'Mali-G78 MP14';
    }
    return {
      vendor: 'ARM',
      renderer,
      version: 'OpenGL ES 3.2',
    };
  }

  /**
   * Aplica patch no libGLESv2_mesa.so (usado no modo de aceleração de GPU host via Mesa/DRI).
   * Intercepta glGetString(GL_VENDOR), glGetString(GL_RENDERER) e glGetString(GL_VERSION)
   * para retornar a GPU do celular real em vez da placa gráfica desktop do PC.
   *
   * Layout de memória estritamente contido em 128 bytes (área de glPrimitiveBoundingBox):
   * 0x00 - 0x10: cmp edi, 0x1f00; jne +8; lea rax, [rip+dispV]; ret
   * 0x10 - 0x20: cmp edi, 0x1f01; jne +8; lea rax, [rip+dispR]; ret
   * 0x20 - 0x30: cmp edi, 0x1f02; jne +8; lea rax, [rip+dispVer]; ret
   * 0x30 - 0x4b: original dispatch via __emutls_get_address@plt
   * 0x4c - 0x7f: strings terminadas em null (vendor, renderer, version)
   */
  static patchMesaLibrary(baseBuffer: Buffer, identity: GpuIdentity): Buffer {
    const buf = Buffer.from(baseBuffer);
    const vaGl = 0xd250;
    const offGl = 0xc250;
    const vaStub = 0xdc40;
    const offStub = 0xcc40;

    // 1. Redireciona glGetString para o stub
    const dispJmp = vaStub - (vaGl + 5);
    buf[offGl] = 0xe9;
    buf.writeInt32LE(dispJmp, offGl + 1);
    for (let i = 5; i < 16; i++) {
      buf[offGl + i] = 0x90; // NOP
    }

    const stub = Buffer.alloc(128, 0x00);

    const offV = 0x4c;
    const offR = 0x58;
    const offVer = 0x6e;

    // 0x00: cmp edi, 0x1f00; jne +8; lea rax, [rip+dispV]; ret
    stub[0x00] = 0x81; stub[0x01] = 0xff; stub[0x02] = 0x00; stub[0x03] = 0x1f; stub[0x04] = 0x00; stub[0x05] = 0x00;
    stub[0x06] = 0x75; stub[0x07] = 0x08;
    const dispV = (vaStub + offV) - (vaStub + 0x08 + 7);
    stub[0x08] = 0x48; stub[0x09] = 0x8d; stub[0x0a] = 0x05;
    stub.writeInt32LE(dispV, 0x0b);
    stub[0x0f] = 0xc3;

    // 0x10: cmp edi, 0x1f01; jne +8; lea rax, [rip+dispR]; ret
    stub[0x10] = 0x81; stub[0x11] = 0xff; stub[0x12] = 0x01; stub[0x13] = 0x1f; stub[0x14] = 0x00; stub[0x15] = 0x00;
    stub[0x16] = 0x75; stub[0x17] = 0x08;
    const dispR = (vaStub + offR) - (vaStub + 0x18 + 7);
    stub[0x18] = 0x48; stub[0x19] = 0x8d; stub[0x1a] = 0x05;
    stub.writeInt32LE(dispR, 0x1b);
    stub[0x1f] = 0xc3;

    // 0x20: cmp edi, 0x1f02; jne +8; lea rax, [rip+dispVer]; ret
    stub[0x20] = 0x81; stub[0x21] = 0xff; stub[0x22] = 0x02; stub[0x23] = 0x1f; stub[0x24] = 0x00; stub[0x25] = 0x00;
    stub[0x26] = 0x75; stub[0x27] = 0x08;
    const dispVer = (vaStub + offVer) - (vaStub + 0x28 + 7);
    stub[0x28] = 0x48; stub[0x29] = 0x8d; stub[0x2a] = 0x05;
    stub.writeInt32LE(dispVer, 0x2b);
    stub[0x2f] = 0xc3;

    // 0x30: dispatch original
    stub[0x30] = 0x53; // push rbx
    stub[0x31] = 0x89; stub[0x32] = 0xfb; // mov ebx, edi
    // mov rdi, [rip+dispEmutlsPtr]
    stub[0x33] = 0x48; stub[0x34] = 0x8b; stub[0x35] = 0x3d;
    const dispEmutlsPtr = 0x11088 - (vaStub + 0x33 + 7);
    stub.writeInt32LE(dispEmutlsPtr, 0x36);
    // call __emutls_get_address@plt
    stub[0x3a] = 0xe8;
    const dispCallEmutls = 0xfec0 - (vaStub + 0x3a + 5);
    stub.writeInt32LE(dispCallEmutls, 0x3b);
    // mov (%rax), rax; mov edi, ebx; pop rbx; jmp *0x898(%rax)
    stub[0x3f] = 0x48; stub[0x40] = 0x8b; stub[0x41] = 0x00;
    stub[0x42] = 0x89; stub[0x43] = 0xdf;
    stub[0x44] = 0x5b;
    stub[0x45] = 0xff; stub[0x46] = 0xa0; stub[0x47] = 0x98; stub[0x48] = 0x08; stub[0x49] = 0x00; stub[0x4a] = 0x00;

    // Strings null-terminated
    const vb = Buffer.from(identity.vendor.slice(0, 11) + '\0', 'utf8');
    const rb = Buffer.from(identity.renderer.slice(0, 21) + '\0', 'utf8');
    const verb = Buffer.from(identity.version.slice(0, 17) + '\0', 'utf8');

    vb.copy(stub, offV);
    rb.copy(stub, offR);
    verb.copy(stub, offVer);

    stub.copy(buf, offStub);
    return buf;
  }

  /**
   * Aplica patch no libGLESv2.so (o despachador central de GLES do Android Bionic).
   * Localizado em /system/lib64/libGLESv2.so
   */
  static patchGles2Library(baseBuffer: Buffer, identity: GpuIdentity): Buffer {
    const buf = Buffer.from(baseBuffer);
    const vaGl = 0x19cc0;
    const offGl = 0x18cc0;
    const vaStub = 0x19a20;
    const offStub = 0x18a20;

    const dispJmp = vaStub - (vaGl + 5);
    buf[offGl] = 0xe9;
    buf.writeInt32LE(dispJmp, offGl + 1);
    for (let i = 5; i < 16; i++) {
      buf[offGl + i] = 0x90; // NOP
    }

    const stub = Buffer.alloc(256, 0x00);
    const offV = 0x42;
    const offR = 0x50;
    const offVer = 0x68;

    // 0x00: cmp edi, 0x1f00; jne +8; lea rax, [rip+dispV]; ret
    stub[0x00] = 0x81; stub[0x01] = 0xff; stub[0x02] = 0x00; stub[0x03] = 0x1f; stub[0x04] = 0x00; stub[0x05] = 0x00;
    stub[0x06] = 0x75; stub[0x07] = 0x08;
    const dispV = (vaStub + offV) - (vaStub + 0x08 + 7);
    stub[0x08] = 0x48; stub[0x09] = 0x8d; stub[0x0a] = 0x05;
    stub.writeInt32LE(dispV, 0x0b);
    stub[0x0f] = 0xc3;

    // 0x10: cmp edi, 0x1f01; jne +8; lea rax, [rip+dispR]; ret
    stub[0x10] = 0x81; stub[0x11] = 0xff; stub[0x12] = 0x01; stub[0x13] = 0x1f; stub[0x14] = 0x00; stub[0x15] = 0x00;
    stub[0x16] = 0x75; stub[0x17] = 0x08;
    const dispR = (vaStub + offR) - (vaStub + 0x18 + 7);
    stub[0x18] = 0x48; stub[0x19] = 0x8d; stub[0x1a] = 0x05;
    stub.writeInt32LE(dispR, 0x1b);
    stub[0x1f] = 0xc3;

    // 0x20: cmp edi, 0x1f02; jne +8; lea rax, [rip+dispVer]; ret
    stub[0x20] = 0x81; stub[0x21] = 0xff; stub[0x22] = 0x02; stub[0x23] = 0x1f; stub[0x24] = 0x00; stub[0x25] = 0x00;
    stub[0x26] = 0x75; stub[0x27] = 0x08;
    const dispVer = (vaStub + offVer) - (vaStub + 0x28 + 7);
    stub[0x28] = 0x48; stub[0x29] = 0x8d; stub[0x2a] = 0x05;
    stub.writeInt32LE(dispVer, 0x2b);
    stub[0x2f] = 0xc3;

    // 0x30: dispatch original
    stub[0x30] = 0x53; // push rbx
    stub[0x31] = 0x89; stub[0x32] = 0xfb; // mov ebx, edi
    // call egl_get_connection@plt (0x19de0)
    stub[0x33] = 0xe8;
    const dispCall = 0x19de0 - (vaStub + 0x33 + 5);
    stub.writeInt32LE(dispCall, 0x34);
    stub[0x38] = 0x89; stub[0x39] = 0xdf; // mov edi, ebx
    stub[0x3a] = 0x5b; // pop rbx
    stub[0x3b] = 0xff; stub[0x3c] = 0xa0; stub[0x3d] = 0x10; stub[0x3e] = 0x05; stub[0x3f] = 0x00; stub[0x40] = 0x00; // jmp *0x510(%rax)

    // Strings
    const vb = Buffer.from(identity.vendor.slice(0, 13) + '\0', 'utf8');
    const rb = Buffer.from(identity.renderer.slice(0, 23) + '\0', 'utf8');
    const verb = Buffer.from(identity.version.slice(0, 17) + '\0', 'utf8');

    vb.copy(stub, offV);
    rb.copy(stub, offR);
    verb.copy(stub, offVer);

    stub.copy(buf, offStub);
    return buf;
  }

  /**
   * Prepara os arquivos de override de GPU para um determinado perfil antes do docker run.
   * Retorna os caminhos dos arquivos gerados para montagem como volume de somente leitura.
   */
  static prepareProfileGpuOverrides(
    profile: { id: string; name?: string; device?: any },
    baseMesaPath: string | null,
    baseGles2Path: string | null,
    outputDir: string
  ): { mesaPath?: string; gles2Path?: string } | null {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const identity = this.resolveGpuIdentity(profile.device);
      let mesaPath: string | undefined;
      let gles2Path: string | undefined;

      if (baseMesaPath && fs.existsSync(baseMesaPath)) {
        const rawMesa = fs.readFileSync(baseMesaPath);
        const patchedMesa = this.patchMesaLibrary(rawMesa, identity);
        const targetMesa = path.join(outputDir, 'libGLESv2_mesa.so');
        fs.writeFileSync(targetMesa, patchedMesa);
        fs.chmodSync(targetMesa, 0o644);
        mesaPath = targetMesa;
      }

      if (baseGles2Path && fs.existsSync(baseGles2Path)) {
        const rawGles2 = fs.readFileSync(baseGles2Path);
        const patchedGles2 = this.patchGles2Library(rawGles2, identity);
        const targetGles2 = path.join(outputDir, 'libGLESv2.so');
        fs.writeFileSync(targetGles2, patchedGles2);
        fs.chmodSync(targetGles2, 0o644);
        gles2Path = targetGles2;
      }

      if (mesaPath || gles2Path) {
        return { mesaPath, gles2Path };
      }
    } catch (err) {
      console.error('[GpuSpoofer] Erro ao preparar overrides de GPU para o perfil:', err);
    }
    return null;
  }
}
