import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";

describe("キュレーションシステムテスト", function () {
    let musicNFT: Contract;
    let rightsManager: Contract;
    let musicStreaming: Contract;
    let owner: SignerWithAddress;
    let artist: SignerWithAddress;
    let curator1: SignerWithAddress;
    let curator2: SignerWithAddress;
    let user: SignerWithAddress;

    beforeEach(async function () {
        [owner, artist, curator1, curator2, user] = await ethers.getSigners();

        // コントラクトのデプロイ
        const MusicNFT = await ethers.getContractFactory("MusicNFT");
        musicNFT = await MusicNFT.deploy();

        const RightsManager = await ethers.getContractFactory("RightsManager");
        rightsManager = await RightsManager.deploy(await musicNFT.getAddress());

        const MusicStreaming = await ethers.getContractFactory("MusicStreaming");
        musicStreaming = await MusicStreaming.deploy(await rightsManager.getAddress());

        // テスト用の音楽NFTを作成
        await musicNFT.connect(artist).mintMusic("ipfs://test1");
        await musicNFT.connect(artist).mintMusic("ipfs://test2");
    });

    describe("プレイリスト作成機能", function () {
        it("キュレーターはプレイリストを作成できる", async function () {
            await musicStreaming.connect(curator1).createCuratedPlaylist(
                "Best Jazz 2024",
                "ジャズセレクション",
                [1],
                true
            );

            const playlist = await musicStreaming.playlists(1);
            expect(playlist.name).to.equal("Best Jazz 2024");
            expect(playlist.creator).to.equal(curator1.address);
        });

        it("空の楽曲リストではプレイリストを作成できない", async function () {
            await expect(
                musicStreaming.connect(curator1).createCuratedPlaylist(
                    "Empty Playlist",
                    "説明",
                    [],
                    true
                )
            ).to.be.revertedWith("Playlist must contain music");
        });
    });

    describe("キュレーション評価システム", function () {
        it("プレイリストのいいねが評価に反映される", async function () {
            // プレイリスト作成
            await musicStreaming.connect(curator1).createCuratedPlaylist(
                "Playlist 1",
                "説明",
                [1],
                true
            );

            // いいねを追加
            await musicStreaming.connect(user).likePlaylist(1);
            
            const reputation = await musicStreaming.getCuratorReputation(curator1.address);
            expect(reputation).to.be.above(0);
        });

        it("フォロワー数が評価に反映される", async function () {
            await musicStreaming.connect(curator1).createCuratedPlaylist(
                "Playlist 1",
                "説明",
                [1],
                true
            );

            await musicStreaming.connect(user).followPlaylist(1);
            
            const newReputation = await musicStreaming.getCuratorReputation(curator1.address);
            expect(newReputation).to.be.above(0);
        });
    });

    describe("楽曲推薦システム", function () {
        it("ユーザーの好みに基づいて楽曲を推薦する", async function () {
            // プレイリスト作成
            await musicStreaming.connect(curator1).createCuratedPlaylist(
                "Playlist 1",
                "説明",
                [1, 2],
                true
            );

            // ユーザーの行動を記録
            await musicStreaming.connect(user).likeMusic(1);
            await musicStreaming.connect(user).followPlaylist(1);

            const recommendations = await musicStreaming.getRecommendedMusic(user.address);
            expect(recommendations.length).to.be.above(0);
        });
    });

    describe("キュレーターランキング", function () {
        it("評価スコアに基づいてキュレーターをランキング付けする", async function () {
            // 2人のキュレーターがプレイリストを作成
            await musicStreaming.connect(curator1).createCuratedPlaylist(
                "Curator 1 Playlist",
                "説明",
                [1],
                true
            );
            await musicStreaming.connect(curator2).createCuratedPlaylist(
                "Curator 2 Playlist",
                "説明",
                [2],
                true
            );

            // いいねとフォロワーを追加
            await musicStreaming.connect(user).likePlaylist(1);
            await musicStreaming.connect(user).followPlaylist(1);

            const topCurators = await musicStreaming.getTopCurators();
            expect(topCurators.length).to.be.above(0);
            expect(topCurators[0]).to.equal(curator1.address);
        });
    });
});
