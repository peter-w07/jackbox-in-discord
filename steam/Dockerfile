FROM lscr.io/linuxserver/webtop:ubuntu-xfce

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG DEBIAN_FRONTEND=noninteractive

RUN \
  echo "**** enable 32-bit and multiverse packages for Steam ****" && \
  dpkg --add-architecture i386 && \
  if [[ -f /etc/apt/sources.list.d/ubuntu.sources ]]; then \
    sed -i -E 's/^Components: .*/Components: main restricted universe multiverse/' /etc/apt/sources.list.d/ubuntu.sources; \
  elif [[ -f /etc/apt/sources.list ]]; then \
    sed -i -E '/^deb / s/( main)( .*)?$/\1 restricted universe multiverse/' /etc/apt/sources.list; \
  fi && \
  apt-get update && \
  echo "**** install Steam and desktop helpers ****" && \
  apt-get install -y --no-install-recommends \
    ca-certificates \
    dbus-x11 \
    file \
    libgl1:i386 \
    libgl1-mesa-dri:i386 \
    libvulkan1:i386 \
    mesa-vulkan-drivers:i386 \
    steam-installer \
    xdg-utils && \
  ln -sf /usr/games/steam /usr/local/bin/steam && \
  echo "**** cleanup ****" && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY custom-cont-init.d/ /custom-cont-init.d/
COPY custom-services.d/ /custom-services.d/

RUN \
  chmod +x /custom-cont-init.d/* /custom-services.d/* && \
  chown -R root:root /custom-cont-init.d /custom-services.d
